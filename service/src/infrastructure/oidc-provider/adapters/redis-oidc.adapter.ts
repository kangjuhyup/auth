import type { Adapter, AdapterPayload } from 'oidc-provider';
import type { Redis } from 'ioredis';

const NEG = '__nil__';

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
    private readonly kind: string,
    private readonly redis: Redis,
  ) {}

  // =========================
  // Key schema
  // =========================
  private key(id: string) {
    return `oidc:${this.kind}:${id}`;
  }

  private uidKey(uid: string) {
    return `oidc:${this.kind}:uid:${uid}`; // value: id | __nil__
  }

  private userCodeKey(userCode: string) {
    return `oidc:${this.kind}:usercode:${userCode}`; // value: id | __nil__
  }

  private grantKey(grantId: string) {
    return `oidc:${this.kind}:grant:${grantId}`; // SET(ids)
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
  }

  async find(id: string): Promise<AdapterPayload | undefined> {
    const stored = await this.getStored(id);
    if (!stored) return undefined;

    const consumed = !!stored.consumedAt;
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
    const k = this.key(id);
    const raw = await this.redis.get(k);
    if (!raw) return;

    const parsed = safeJsonParse<Stored>(raw);
    if (!parsed?.payload || !parsed.meta) return;

    const ttl = await this.redis.ttl(k); // 남은 TTL 보존

    parsed.consumedAt = new Date().toISOString();

    if (ttl && ttl > 0) {
      await this.redis.set(k, JSON.stringify(parsed), 'EX', ttl);
    } else {
      await this.redis.set(k, JSON.stringify(parsed));
    }
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
      `oidc:${this.kind}:neg:${id}`,
      NEG,
      'EX',
      Math.max(1, ttlSec),
    );
  }

  async isNegativeCachedById(id: string): Promise<boolean> {
    const v = await this.redis.get(`oidc:${this.kind}:neg:${id}`);
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
