import { OidcModelOrmEntity } from '@infrastructure/mikro-orm/entities/oidc-model';
import { RdbOidcAdapter } from '@infrastructure/oidc-provider/adapters/rdb-oidc.adapter';
import { RedisAdapter } from '@infrastructure/oidc-provider/adapters/redis-oidc.adapter';
import { RefreshTokenReuseStore } from '@infrastructure/oidc-provider/refresh-token-reuse.store';
import {
  InMemoryRedis,
  LightweightEntityManager,
} from './adapter/support/in-memory-stores';

describe('RefreshTokenReuseStore', () => {
  let em: LightweightEntityManager;
  let redis: InMemoryRedis;

  beforeEach(() => {
    em = new LightweightEntityManager();
    redis = new InMemoryRedis();
  });

  it('RDB marker를 조회하고 audit claim을 원자적으로 한 번만 획득한다', async () => {
    em.create(OidcModelOrmEntity, {
      tenantId: 'tenant-a',
      kind: 'RefreshTokenReuseConflict',
      id: 'refresh-token-1',
      payload: { grantId: 'grant-1' },
      expiresAt: null,
    });
    em.create(OidcModelOrmEntity, {
      tenantId: 'tenant-a',
      kind: 'Grant',
      id: 'grant-1',
      payload: {},
      expiresAt: null,
    });
    em.create(OidcModelOrmEntity, {
      tenantId: 'tenant-a',
      kind: 'RefreshTokenReuseGrantConflict',
      id: 'grant-1',
      payload: { tokenId: 'refresh-token-1' },
      expiresAt: null,
    });
    const store = new RefreshTokenReuseStore(
      'tenant-a',
      'rdb',
      em as any,
      redis as any,
    );

    await expect(store.hasConflict('refresh-token-1', 'grant-1')).resolves.toBe(
      true,
    );
    await expect(store.hasGrantConflict('grant-1')).resolves.toBe(true);
    await expect(store.claimCleanup('grant-1')).resolves.toBe(true);
    await expect(store.claimCleanup('grant-1')).resolves.toBe(false);
    await expect(store.claimAudit('refresh-token-1')).resolves.toBe(true);
    await expect(store.claimAudit('refresh-token-1')).resolves.toBe(false);
  });

  it('Redis marker를 조회하고 audit claim을 원자적으로 한 번만 획득한다', async () => {
    await redis.set('oidc:tenant-a:reuse-conflict:refresh-token-1', 'grant-1');
    await redis.set(
      'oidc:tenant-a:reuse-conflict:grant:grant-1',
      'refresh-token-1',
    );
    const store = new RefreshTokenReuseStore(
      'tenant-a',
      'redis',
      em as any,
      redis as any,
    );

    await expect(store.hasConflict('refresh-token-1', 'grant-1')).resolves.toBe(
      true,
    );
    await expect(store.hasGrantConflict('grant-1')).resolves.toBe(true);
    await expect(store.claimCleanup('grant-1')).resolves.toBe(true);
    await expect(store.claimCleanup('grant-1')).resolves.toBe(false);
    await expect(store.claimAudit('refresh-token-1')).resolves.toBe(true);
    await expect(store.claimAudit('refresh-token-1')).resolves.toBe(false);
  });

  it('hybrid token family를 RDB와 Redis 양쪽에서 tenant 범위로 폐기한다', async () => {
    const rdbAccess = new RdbOidcAdapter('tenant-a', 'AccessToken', em as any);
    const rdbGrant = new RdbOidcAdapter('tenant-a', 'Grant', em as any);
    const redisAccess = new RedisAdapter(
      'tenant-a',
      'AccessToken',
      redis as any,
    );
    const redisGrant = new RedisAdapter('tenant-a', 'Grant', redis as any);
    await rdbAccess.upsert('access-token-1', { grantId: 'grant-1' } as any, 60);
    await rdbGrant.upsert('grant-1', {} as any, 60);
    await redisAccess.upsert(
      'access-token-1',
      { grantId: 'grant-1' } as any,
      60,
    );
    await redisGrant.upsert('grant-1', {} as any, 60);
    const store = new RefreshTokenReuseStore(
      'tenant-a',
      'hybrid',
      em as any,
      redis as any,
    );

    await store.revokeGrantFamily('grant-1');

    await expect(rdbAccess.find('access-token-1')).resolves.toBeUndefined();
    await expect(rdbGrant.find('grant-1')).resolves.toBeUndefined();
    await expect(redisAccess.find('access-token-1')).resolves.toBeUndefined();
    await expect(redisGrant.find('grant-1')).resolves.toBeUndefined();
  });
});
