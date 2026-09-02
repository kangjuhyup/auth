import { LockMode, type EntityManager } from '@mikro-orm/core';
import type Redis from 'ioredis';
import { OidcModelOrmEntity } from '../mikro-orm/entities/oidc-model';
import { RedisAdapter } from './adapters/redis-oidc.adapter';
import type { OidcAdapterDriver } from './adapters/oidc-adapter.constants';
import {
  OIDC_GRANT_BOUND_KINDS,
  REFRESH_TOKEN_REUSE_AUDIT_KIND,
  REFRESH_TOKEN_REUSE_CLEANUP_KIND,
  REFRESH_TOKEN_REUSE_CONFLICT_KIND,
  REFRESH_TOKEN_REUSE_COORDINATION_TTL_SEC,
  REFRESH_TOKEN_REUSE_GRANT_CONFLICT_KIND,
  redisRefreshTokenReuseAuditKey,
  redisRefreshTokenReuseCleanupKey,
  redisRefreshTokenReuseConflictKey,
  redisRefreshTokenReuseGrantConflictKey,
} from './refresh-token-reuse.constants';

export class RefreshTokenReuseStore {
  constructor(
    private readonly tenantId: string,
    private readonly driver: OidcAdapterDriver,
    private readonly em: EntityManager,
    private readonly redis: Redis,
  ) {}

  async hasConflict(tokenId: string, grantId: string): Promise<boolean> {
    if (this.driver === 'redis') {
      return (
        (await this.redis.get(
          redisRefreshTokenReuseConflictKey(this.tenantId, tokenId),
        )) === grantId
      );
    }

    const marker = await this.em.fork().findOne(OidcModelOrmEntity, {
      tenantId: this.tenantId,
      kind: REFRESH_TOKEN_REUSE_CONFLICT_KIND,
      id: tokenId,
    });
    return marker?.payload?.grantId === grantId;
  }

  async claimAudit(tokenId: string): Promise<boolean> {
    if (this.driver === 'redis') {
      const claimed = await this.redis.set(
        redisRefreshTokenReuseAuditKey(this.tenantId, tokenId),
        '1',
        'EX',
        REFRESH_TOKEN_REUSE_COORDINATION_TTL_SEC,
        'NX',
      );
      return claimed === 'OK';
    }

    const em = this.em.fork();
    try {
      await em.insert(OidcModelOrmEntity, {
        tenantId: this.tenantId,
        kind: REFRESH_TOKEN_REUSE_AUDIT_KIND,
        id: tokenId,
        payload: {},
        uid: null,
        grantId: null,
        userCode: null,
        consumedAt: null,
        expiresAt: new Date(
          Date.now() + REFRESH_TOKEN_REUSE_COORDINATION_TTL_SEC * 1000,
        ),
        createdAt: new Date(),
      });
      return true;
    } catch (error) {
      const existing = await this.em.fork().findOne(OidcModelOrmEntity, {
        tenantId: this.tenantId,
        kind: REFRESH_TOKEN_REUSE_AUDIT_KIND,
        id: tokenId,
      });
      if (existing) return false;
      throw error;
    }
  }

  async hasGrantConflict(grantId: string): Promise<boolean> {
    if (this.driver === 'redis') {
      return (
        (await this.redis.get(
          redisRefreshTokenReuseGrantConflictKey(this.tenantId, grantId),
        )) !== null
      );
    }

    const marker = await this.em.fork().findOne(OidcModelOrmEntity, {
      tenantId: this.tenantId,
      kind: REFRESH_TOKEN_REUSE_GRANT_CONFLICT_KIND,
      id: grantId,
    });
    return marker !== null;
  }

  async claimCleanup(grantId: string): Promise<boolean> {
    const redisClaim = await this.redis.set(
      redisRefreshTokenReuseCleanupKey(this.tenantId, grantId),
      '1',
      'EX',
      REFRESH_TOKEN_REUSE_COORDINATION_TTL_SEC,
      'NX',
    );
    if (redisClaim !== 'OK') return false;
    if (this.driver === 'redis') return true;

    const em = this.em.fork();
    let claimed = false;
    await em.transactional(async (tx) => {
      const grant = await tx.findOne(
        OidcModelOrmEntity,
        { tenantId: this.tenantId, kind: 'Grant', id: grantId },
        { lockMode: LockMode.PESSIMISTIC_WRITE },
      );
      if (!grant) return;

      const existing = await tx.findOne(OidcModelOrmEntity, {
        tenantId: this.tenantId,
        kind: REFRESH_TOKEN_REUSE_CLEANUP_KIND,
        id: grantId,
      });
      if (existing?.expiresAt && existing.expiresAt > new Date()) return;
      if (existing) {
        await tx.nativeDelete(OidcModelOrmEntity, {
          tenantId: this.tenantId,
          kind: REFRESH_TOKEN_REUSE_CLEANUP_KIND,
          id: grantId,
        });
      }

      await tx.insert(OidcModelOrmEntity, {
        tenantId: this.tenantId,
        kind: REFRESH_TOKEN_REUSE_CLEANUP_KIND,
        id: grantId,
        payload: {},
        uid: null,
        grantId: null,
        userCode: null,
        consumedAt: null,
        expiresAt: new Date(
          Date.now() + REFRESH_TOKEN_REUSE_COORDINATION_TTL_SEC * 1000,
        ),
        createdAt: new Date(),
      });
      claimed = true;
    });
    return claimed;
  }

  async revokeGrantFamily(grantId: string): Promise<void> {
    if (this.driver !== 'redis') {
      const em = this.em.fork();
      await em.nativeDelete(OidcModelOrmEntity, {
        tenantId: this.tenantId,
        grantId,
      });
      await em.nativeDelete(OidcModelOrmEntity, {
        tenantId: this.tenantId,
        kind: 'Grant',
        id: grantId,
      });
    }

    if (this.driver !== 'rdb') {
      for (const kind of OIDC_GRANT_BOUND_KINDS) {
        await new RedisAdapter(this.tenantId, kind, this.redis).revokeByGrantId(
          grantId,
        );
      }
      await new RedisAdapter(this.tenantId, 'Grant', this.redis).destroy(
        grantId,
      );
    }
  }
}
