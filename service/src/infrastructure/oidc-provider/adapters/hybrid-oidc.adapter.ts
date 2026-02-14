import type { Adapter, AdapterPayload } from 'oidc-provider';
import { RedisAdapter } from './redis-oidc.adapter';

// Hybrid 내부에서 “cache”를 RedisAdapter로 확정해서
// resolveId/negative cache 같은 확장 메서드를 활용합니다.
type HybridParams = {
  kind: string;
  rdb: Adapter;
  cache: RedisAdapter;

  // upsert에서 Redis TTL을 약간 줄여 만료 경계 문제 방지
  cacheTtlMarginSec: number;

  // DB 미존재/미스에 대한 negative cache TTL
  negativeTtlSec: number;

  // find miss 후 RDB hit 시 cache backfill TTL (upsert를 놓쳤을 때 대비)
  // exp를 모르기 때문에 “짧게”가 안전
  backfillTtlSec: number;
};

export class HybridAdapter implements Adapter {
  private readonly kind: string;
  private readonly rdb: Adapter;
  private readonly cache: RedisAdapter;

  private readonly ttlMargin: number;
  private readonly negativeTtl: number;
  private readonly backfillTtl: number;

  constructor(params: HybridParams) {
    this.kind = params.kind;
    this.rdb = params.rdb;
    this.cache = params.cache;

    this.ttlMargin = params.cacheTtlMarginSec;
    this.negativeTtl = params.negativeTtlSec;
    this.backfillTtl = params.backfillTtlSec;
  }

  // =========================
  // Write-through
  // =========================

  async upsert(
    id: string,
    payload: AdapterPayload,
    expiresIn: number,
  ): Promise<void> {
    await this.rdb.upsert(id, payload, expiresIn);

    await this.bestEffort(async () => {
      const ttl = this.adjustTtl(expiresIn);
      await this.cache.upsert(id, payload, ttl);
    });
  }

  async consume(id: string): Promise<void> {
    await this.rdb.consume(id);

    // consume은 consumed=true 상태가 중요.
    // 캐시 일관성을 위해 “삭제”보다 “consume 반영”이 더 정확하지만,
    // RedisAdapter.consume은 TTL 유지하며 consumedAt만 추가하므로 안전.
    await this.bestEffort(async () => {
      await this.cache.consume(id);
    });
  }

  async destroy(id: string): Promise<void> {
    await this.rdb.destroy(id);

    // 캐시/인덱스까지 정리(완성형 RedisAdapter는 meta 기반 정리 가능)
    await this.bestEffort(async () => {
      await this.cache.destroy(id);
      // id negative cache는 별도 키이므로 같이 정리(있다면)
      // isNegativeCachedById가 true여도 별도 del API가 없으니 그냥 놔도 TTL로 사라짐.
    });
  }

  async revokeByGrantId(grantId: string): Promise<void> {
    await (this.rdb as any).revokeByGrantId(grantId);

    // Redis는 set 기반이라 revokeByGrantId 정리가 매우 효율적
    await this.bestEffort(async () => {
      await this.cache.revokeByGrantId(grantId);
    });
  }

  // =========================
  // Read path (폭격 방지 + hit율 극대화)
  // =========================

  async find(id: string): Promise<AdapterPayload | undefined> {
    // 0) id negative cache 확인 (DB 폭격 방지)
    const neg = await this.bestEffortReturn(async () => {
      return await this.cache.isNegativeCachedById(id);
    }, false);

    if (neg) return undefined;

    // 1) cache first
    const cached = await this.bestEffortReturn(async () => {
      return await this.cache.find(id);
    }, undefined);

    if (cached) return cached;

    // 2) cache miss -> RDB 조회
    const data = await this.rdb.find(id);
    if (!data) {
      // 3) RDB miss -> negative cache (짧게)
      await this.bestEffort(async () => {
        await this.cache.negativeCacheById(id, this.negativeTtl);
      });
      return undefined;
    }

    // 4) RDB hit -> cache backfill (짧게, upsert 경로 누락 대비)
    await this.bestEffort(async () => {
      await this.cache.cacheById(id, data, this.backfillTtl);
    });

    return data;
  }

  async findByUid(uid: string): Promise<AdapterPayload | undefined> {
    // 0) uid negative cache 확인
    // (완성형 RedisAdapter는 negativeCacheUid를 제공하지만,
    //  "isNegativeCachedByUid"는 없으므로 resolveIdByUid로 NEG 처리)
    const cachedId = await this.bestEffortReturn(async () => {
      return await this.cache.resolveIdByUid(uid);
    }, undefined);

    if (cachedId) {
      // uid 인덱스 hit -> find(id)로 본문/negative 처리(폭격 방지 포함)
      return this.find(cachedId);
    }

    // 1) uid 인덱스 miss -> cache에서 payload 직접 조회(findByUid) 시도
    // (RedisAdapter.findByUid는 내부에서 resolveIdByUid + find를 호출하는 구조일 수 있어 중복이지만,
    //  구현에 따라 다를 수 있으니 안전하게 한 번 더 시도 가능)
    const cachedPayload = await this.bestEffortReturn(async () => {
      return await this.cache.findByUid(uid);
    }, undefined);

    if (cachedPayload) return cachedPayload;

    // 2) 완전 cache miss -> RDB 조회
    const data = await (this.rdb as any).findByUid(uid);
    if (!data) {
      // 3) RDB miss -> uid negative cache
      await this.bestEffort(async () => {
        await this.cache.negativeCacheUid(uid, this.negativeTtl);
      });
      return undefined;
    }

    // 4) RDB hit -> 캐시를 최대한 채우고 싶지만,
    // AdapterPayload만으로는 “id”를 알 수 없는 경우가 많음.
    // => 여기서는 “uid negative cache는 하지 않고”,
    //    payload 캐시 backfill도 안전하게 할 수 없으므로 그대로 반환.
    // (정말 극대화하려면 RDB adapter에 uid->id 조회 메서드를 추가해야 함)
    return data;
  }

  async findByUserCode(userCode: string): Promise<AdapterPayload | undefined> {
    // 0) userCode 인덱스로 id resolve 시도
    const cachedId = await this.bestEffortReturn(async () => {
      return await this.cache.resolveIdByUserCode(userCode);
    }, undefined);

    if (cachedId) {
      return this.find(cachedId);
    }

    // 1) cache에서 payload 직접 조회
    const cachedPayload = await this.bestEffortReturn(async () => {
      return await this.cache.findByUserCode(userCode);
    }, undefined);

    if (cachedPayload) return cachedPayload;

    // 2) RDB 조회
    const data = await (this.rdb as any).findByUserCode(userCode);
    if (!data) {
      await this.bestEffort(async () => {
        await this.cache.negativeCacheUserCode(userCode, this.negativeTtl);
      });
      return undefined;
    }

    // userCode도 uid와 동일하게 payload만으로 id를 알기 어려움 → 그대로 반환
    return data;
  }

  // =========================
  // Helpers
  // =========================

  private adjustTtl(expiresIn?: number): number | undefined {
    if (!expiresIn || expiresIn <= 0) return undefined;
    return Math.max(1, Math.floor(expiresIn - this.ttlMargin));
  }

  private async bestEffort(fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
    } catch {
      // 캐시 실패는 기능 실패로 보지 않음 (로그는 infra observability에서)
    }
  }

  private async bestEffortReturn<T>(
    fn: () => Promise<T>,
    fallback: T,
  ): Promise<T> {
    try {
      return await fn();
    } catch {
      return fallback;
    }
  }
}
