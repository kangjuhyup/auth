import type { Adapter, AdapterPayload } from 'oidc-provider';
import type { Redis } from 'ioredis';
import type { OidcSessionIndexStore } from '../session/oidc-session-index.store';
import { createOidcInvalidGrantError } from '../oidc-provider.loader';
import {
  OIDC_GRANT_BOUND_KINDS,
  redisRefreshTokenReuseConflictKey,
  redisRefreshTokenReuseGrantConflictKey,
} from '../refresh-token-reuse.constants';

const NEG = '__nil__';

const CONSUME_ONCE_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then
  return {0, ''}
end

local decoded, stored = pcall(cjson.decode, raw)
if not decoded or type(stored) ~= 'table' then
  return {-2, ''}
end

local grantId = stored.meta and stored.meta.grantId
if type(grantId) == 'string' and string.len(grantId) > 0 then
  if redis.call('GET', KEYS[3] .. grantId) then
    return {-1, grantId}
  end
end

if stored.consumedAt ~= nil and stored.consumedAt ~= cjson.null then
  if type(grantId) == 'string' and string.len(grantId) > 0 then
    redis.call('SET', KEYS[2], grantId)
    redis.call('SET', KEYS[3] .. grantId, ARGV[2])
    return {-1, grantId}
  end
  return {-1, ''}
end

stored.consumedAt = ARGV[1]
local ttl = redis.call('PTTL', KEYS[1])
if ttl >= 0 then
  redis.call('SET', KEYS[1], cjson.encode(stored), 'PX', math.max(ttl, 1))
elseif ttl == -1 then
  redis.call('SET', KEYS[1], cjson.encode(stored))
else
  return {0, ''}
end

return {1, ''}
`;

type StoredMeta = {
  uid?: string | null;
  userCode?: string | null;
  grantId?: string | null;
};

type Stored = {
  payload: Record<string, unknown>;
  meta: StoredMeta;
  consumedAt?: string | null; // ISO
};

export class RedisAdapter implements Adapter {
  constructor(
    private readonly tenantId: string,
    private readonly kind: string,
    private readonly redis: Redis,
    private readonly sessionIndex?: OidcSessionIndexStore,
  ) {}

  // =========================
  // Key schema
  // =========================
  private prefix() {
    return `oidc:${this.tenantId}:${this.kind}`;
  }

  private key(id: string) {
    return `${this.prefix()}:${id}`;
  }

  private uidKey(uid: string) {
    return `${this.prefix()}:uid:${uid}`; // value: id | __nil__
  }

  private userCodeKey(userCode: string) {
    return `${this.prefix()}:usercode:${userCode}`; // value: id | __nil__
  }

  private grantKey(grantId: string) {
    return `${this.prefix()}:grant:${grantId}`; // SET(ids)
  }

  private negativeIdKey(id: string) {
    return `${this.prefix()}:neg:${id}`;
  }

  // =========================
  // Adapter interface
  // =========================

  async upsert(
    id: string,
    payload: AdapterPayload,
    expiresIn?: number,
  ): Promise<void> {
    const ttl = normalizeTtl(expiresIn);

    // 기존 meta 읽어서 인덱스 변경 시 정리
    const prev = await this.getStored(id);

    const nextMeta: StoredMeta = {
      uid: payload.uid ?? null,
      userCode: payload.userCode ?? null,
      grantId: payload.grantId ?? null,
    };

    const stored: Stored = {
      payload: payload as any,
      meta: nextMeta,
      consumedAt: prev?.consumedAt ?? null, // upsert 시 consumed 상태 보존(대부분은 상관없지만 안전)
    };

    const multi = this.redis.multi();

    // 1) 본문 저장
    multi.set(this.key(id), JSON.stringify(stored));
    if (ttl) multi.expire(this.key(id), ttl);

    // 2) 인덱스 정리(이전 값이 있고 값이 바뀐 경우)
    if (prev?.meta?.uid && prev.meta.uid !== nextMeta.uid) {
      multi.del(this.uidKey(prev.meta.uid));
    }
    if (prev?.meta?.userCode && prev.meta.userCode !== nextMeta.userCode) {
      multi.del(this.userCodeKey(prev.meta.userCode));
    }
    if (prev?.meta?.grantId && prev.meta.grantId !== nextMeta.grantId) {
      // set에서 id 제거
      multi.srem(this.grantKey(prev.meta.grantId), id);
    }

    // 3) 새 인덱스 설정
    if (nextMeta.uid) {
      multi.set(this.uidKey(nextMeta.uid), id);
      if (ttl) multi.expire(this.uidKey(nextMeta.uid), ttl);
    }
    if (nextMeta.userCode) {
      multi.set(this.userCodeKey(nextMeta.userCode), id);
      if (ttl) multi.expire(this.userCodeKey(nextMeta.userCode), ttl);
    }
    if (nextMeta.grantId) {
      multi.sadd(this.grantKey(nextMeta.grantId), id);
      if (ttl) multi.expire(this.grantKey(nextMeta.grantId), ttl);
    }

    await multi.exec();
    if (
      typeof nextMeta.grantId === 'string' &&
      OIDC_GRANT_BOUND_KINDS.includes(this.kind as any) &&
      (await this.redis.get(
        redisRefreshTokenReuseGrantConflictKey(this.tenantId, nextMeta.grantId),
      ))
    ) {
      await this.destroy(id);
    }
    if (this.kind === 'Session') {
      const expiresAt = ttl ? new Date(Date.now() + ttl * 1000) : null;
      await this.sessionIndex?.upsertSession(id, payload, expiresAt);
    }
  }

  async find(id: string): Promise<AdapterPayload | undefined> {
    const stored = await this.getStored(id);
    if (!stored) return undefined;

    const consumed = !!stored.consumedAt;
    if (
      this.kind === 'RefreshToken' &&
      consumed &&
      typeof stored.meta.grantId === 'string'
    ) {
      await this.markRefreshTokenReuseConflict(id, stored.meta.grantId);
    } else if (
      typeof stored.meta.grantId === 'string' &&
      OIDC_GRANT_BOUND_KINDS.includes(this.kind as any) &&
      (await this.redis.get(
        redisRefreshTokenReuseGrantConflictKey(
          this.tenantId,
          stored.meta.grantId,
        ),
      ))
    ) {
      return undefined;
    }
    return {
      ...(stored.payload as any),
      ...(consumed ? { consumed: true } : undefined),
    } as AdapterPayload;
  }

  async findByUid(uid: string): Promise<AdapterPayload | undefined> {
    const id = await this.resolveIdByUid(uid);
    if (!id) return undefined;
    return this.find(id);
  }

  async findByUserCode(userCode: string): Promise<AdapterPayload | undefined> {
    const id = await this.resolveIdByUserCode(userCode);
    if (!id) return undefined;
    return this.find(id);
  }

  async consume(id: string): Promise<void> {
    const result = (await this.redis.eval(
      CONSUME_ONCE_SCRIPT,
      3,
      this.key(id),
      redisRefreshTokenReuseConflictKey(this.tenantId, id),
      redisRefreshTokenReuseGrantConflictKey(this.tenantId, ''),
      new Date().toISOString(),
      id,
    )) as [number | string, string?];
    const consumed = Number(result[0]);
    if (consumed !== 1) {
      throw await createOidcInvalidGrantError('token already consumed');
    }
  }

  async markRefreshTokenReuseConflict(
    tokenId: string,
    grantId: string,
  ): Promise<void> {
    await this.redis.set(
      redisRefreshTokenReuseConflictKey(this.tenantId, tokenId),
      grantId,
    );
    await this.redis.set(
      redisRefreshTokenReuseGrantConflictKey(this.tenantId, grantId),
      tokenId,
    );
  }

  async destroy(id: string): Promise<void> {
    // meta를 알아야 인덱스까지 정리 가능하므로 먼저 읽는다
    const stored = await this.getStored(id);

    const multi = this.redis.multi();
    multi.del(this.key(id));

    if (stored?.meta?.uid) multi.del(this.uidKey(stored.meta.uid));
    if (stored?.meta?.userCode)
      multi.del(this.userCodeKey(stored.meta.userCode));
    if (stored?.meta?.grantId)
      multi.srem(this.grantKey(stored.meta.grantId), id);

    await multi.exec();
    if (this.kind === 'Session') {
      await this.sessionIndex?.destroySession(id);
    }
  }

  async revokeByGrantId(grantId: string): Promise<void> {
    const gk = this.grantKey(grantId);
    const ids = await this.redis.smembers(gk);

    if (ids.length === 0) {
      await this.redis.del(gk);
      return;
    }

    // 각 id에 대해 본문과 인덱스를 정리해야 완전
    // => stored meta를 읽어야 해서 파이프라인으로 처리
    const multi = this.redis.multi();

    for (const id of ids) {
      const stored = await this.getStored(id);
      multi.del(this.key(id));

      if (stored?.meta?.uid) multi.del(this.uidKey(stored.meta.uid));
      if (stored?.meta?.userCode)
        multi.del(this.userCodeKey(stored.meta.userCode));
      // grant set 정리는 마지막에 gk 삭제로 충분하지만, 일단 srem도 해두면 안전
      multi.srem(gk, id);
    }

    multi.del(gk);
    await multi.exec();
    if (this.kind === 'Session') {
      await this.sessionIndex?.deleteByGrantIds([grantId]);
    }
  }

  // =========================
  // Hybrid-friendly extras
  // =========================

  async resolveIdByUid(uid: string): Promise<string | undefined> {
    const v = await this.redis.get(this.uidKey(uid));
    if (!v || v === NEG) return undefined;
    return v;
  }

  async resolveIdByUserCode(userCode: string): Promise<string | undefined> {
    const v = await this.redis.get(this.userCodeKey(userCode));
    if (!v || v === NEG) return undefined;
    return v;
  }

  async cacheById(
    id: string,
    payload: AdapterPayload,
    ttlSec: number,
  ): Promise<void> {
    await this.upsert(id, payload, ttlSec);
  }

  async negativeCacheById(id: string, ttlSec: number): Promise<void> {
    // 본문 negative cache는 Stored 형태로도 가능하지만, find에서 payload를 기대하므로
    // "없는 값"을 본문 키에 넣는 건 위험할 수 있음.
    // => id negative는 Hybrid에서 따로 관리하거나(다른 prefix), 여기선 권장하지 않음.
    // 필요하면 아래처럼 별도 키를 쓰는 것을 추천.
    await this.redis.set(
      this.negativeIdKey(id),
      NEG,
      'EX',
      Math.max(1, ttlSec),
    );
  }

  async isNegativeCachedById(id: string): Promise<boolean> {
    const v = await this.redis.get(this.negativeIdKey(id));
    return v === NEG;
  }

  async negativeCacheUid(uid: string, ttlSec: number): Promise<void> {
    await this.redis.set(this.uidKey(uid), NEG, 'EX', Math.max(1, ttlSec));
  }

  async negativeCacheUserCode(userCode: string, ttlSec: number): Promise<void> {
    await this.redis.set(
      this.userCodeKey(userCode),
      NEG,
      'EX',
      Math.max(1, ttlSec),
    );
  }

  // =========================
  // internal helpers
  // =========================

  private async getStored(id: string): Promise<Stored | undefined> {
    const raw = await this.redis.get(this.key(id));
    if (!raw) return undefined;

    const parsed = safeJsonParse<Stored>(raw);
    if (!parsed?.payload || !parsed?.meta) return undefined;

    return parsed;
  }
}

function normalizeTtl(expiresIn?: number): number | undefined {
  if (!expiresIn || expiresIn <= 0) return undefined;
  return Math.floor(expiresIn);
}

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
