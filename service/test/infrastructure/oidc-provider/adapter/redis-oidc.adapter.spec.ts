import { RedisAdapter } from '@infrastructure/oidc-provider/adapters/redis-oidc.adapter';
import { InMemoryRedis } from './support/in-memory-stores';

jest.mock('@infrastructure/oidc-provider/oidc-provider.loader', () => ({
  createOidcInvalidGrantError: async (detail: string) =>
    Object.assign(new Error('invalid_grant'), {
      error: 'invalid_grant',
      error_detail: detail,
      statusCode: 400,
    }),
}));

describe('RedisAdapter integration', () => {
  let redis: InMemoryRedis;
  let adapter: RedisAdapter;

  beforeEach(() => {
    redis = new InMemoryRedis();
    adapter = new RedisAdapter('tenant-a', 'AccessToken', redis as any);
  });

  it('upsert 후 id, uid, userCode로 end-to-end 조회할 수 있다', async () => {
    await adapter.upsert(
      'token-1',
      {
        sub: 'user-1',
        uid: 'uid-1',
        userCode: 'code-1',
        grantId: 'grant-1',
      } as any,
      60,
    );

    await expect(adapter.find('token-1')).resolves.toMatchObject({
      sub: 'user-1',
      uid: 'uid-1',
      userCode: 'code-1',
      grantId: 'grant-1',
    });
    await expect(adapter.findByUid('uid-1')).resolves.toMatchObject({
      sub: 'user-1',
    });
    await expect(adapter.findByUserCode('code-1')).resolves.toMatchObject({
      sub: 'user-1',
    });
    await expect(
      redis.smembers('oidc:tenant-a:AccessToken:grant:grant-1'),
    ).resolves.toEqual(['token-1']);
  });

  it('같은 id를 다시 upsert하면 이전 uid/userCode/grant 인덱스를 정리한다', async () => {
    await adapter.upsert(
      'token-1',
      {
        uid: 'uid-1',
        userCode: 'code-1',
        grantId: 'grant-1',
      } as any,
      60,
    );

    await adapter.upsert(
      'token-1',
      {
        uid: 'uid-2',
        userCode: 'code-2',
        grantId: 'grant-2',
      } as any,
      60,
    );

    await expect(adapter.findByUid('uid-1')).resolves.toBeUndefined();
    await expect(adapter.findByUserCode('code-1')).resolves.toBeUndefined();
    await expect(adapter.findByUid('uid-2')).resolves.toMatchObject({
      uid: 'uid-2',
      grantId: 'grant-2',
    });
    await expect(
      redis.smembers('oidc:tenant-a:AccessToken:grant:grant-1'),
    ).resolves.toEqual([]);
  });

  it('consume 하면 TTL을 유지하면서 consumed 플래그를 추가한다', async () => {
    await adapter.upsert('token-1', { sub: 'user-1', uid: 'uid-1' } as any, 30);

    redis.advanceTime(5000);
    const ttlBefore = await redis.ttl('oidc:tenant-a:AccessToken:token-1');

    await adapter.consume('token-1');

    const ttlAfter = await redis.ttl('oidc:tenant-a:AccessToken:token-1');
    expect(ttlBefore).toBeGreaterThan(0);
    expect(ttlAfter).toBeGreaterThan(0);
    expect(ttlAfter).toBeLessThanOrEqual(ttlBefore);
    await expect(adapter.find('token-1')).resolves.toMatchObject({
      consumed: true,
      sub: 'user-1',
    });
  });

  it('동일한 refresh token을 동시에 consume하면 정확히 하나만 성공한다', async () => {
    const refreshTokenAdapter = new RedisAdapter(
      'tenant-a',
      'RefreshToken',
      redis as any,
    );
    await refreshTokenAdapter.upsert(
      'refresh-token-1',
      { grantId: 'grant-1', clientId: 'e-vote' } as any,
      60,
    );
    await refreshTokenAdapter.upsert(
      'refresh-token-child',
      { grantId: 'grant-1', clientId: 'e-vote' } as any,
      120,
    );
    await adapter.upsert(
      'access-token-child',
      { grantId: 'grant-1', clientId: 'e-vote' } as any,
      120,
    );

    const results = await Promise.allSettled([
      refreshTokenAdapter.consume('refresh-token-1'),
      refreshTokenAdapter.consume('refresh-token-1'),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected');
    expect(rejected).toMatchObject({
      status: 'rejected',
      reason: { error: 'invalid_grant', statusCode: 400 },
    });
    await expect(
      redis.get('oidc:tenant-a:reuse-conflict:refresh-token-1'),
    ).resolves.toBe('grant-1');
    await expect(
      redis.get('oidc:tenant-a:reuse-conflict:grant:grant-1'),
    ).resolves.toBe('refresh-token-1');
    await expect(
      redis.ttl('oidc:tenant-a:reuse-conflict:grant:grant-1'),
    ).resolves.toBe(-1);

    redis.advanceTime(61_000);
    await expect(
      refreshTokenAdapter.consume('refresh-token-child'),
    ).rejects.toMatchObject({ error: 'invalid_grant', statusCode: 400 });
    await expect(
      refreshTokenAdapter.find('refresh-token-child'),
    ).resolves.toBeUndefined();
    await expect(adapter.find('access-token-child')).resolves.toBeUndefined();
  });

  it('reuse marker 뒤 늦게 저장되는 grant-bound token을 남기지 않는다', async () => {
    await redis.set(
      'oidc:tenant-a:reuse-conflict:grant:grant-1',
      'refresh-token-1',
      'EX',
      60,
    );

    await adapter.upsert(
      'late-access-token',
      { grantId: 'grant-1', clientId: 'e-vote' } as any,
      60,
    );

    await expect(adapter.find('late-access-token')).resolves.toBeUndefined();
    await expect(
      redis.smembers('oidc:tenant-a:AccessToken:grant:grant-1'),
    ).resolves.toEqual([]);
  });

  it('destroy는 본문과 uid/userCode/grant 인덱스를 함께 정리한다', async () => {
    await adapter.upsert(
      'token-1',
      {
        sub: 'user-1',
        uid: 'uid-1',
        userCode: 'code-1',
        grantId: 'grant-1',
      } as any,
      60,
    );

    await adapter.destroy('token-1');

    await expect(adapter.find('token-1')).resolves.toBeUndefined();
    await expect(adapter.findByUid('uid-1')).resolves.toBeUndefined();
    await expect(adapter.findByUserCode('code-1')).resolves.toBeUndefined();
    await expect(
      redis.smembers('oidc:tenant-a:AccessToken:grant:grant-1'),
    ).resolves.toEqual([]);
  });

  it('revokeByGrantId는 같은 grant에 묶인 토큰을 모두 제거한다', async () => {
    await adapter.upsert(
      'token-1',
      { uid: 'uid-1', grantId: 'grant-1' } as any,
      60,
    );
    await adapter.upsert(
      'token-2',
      { uid: 'uid-2', grantId: 'grant-1' } as any,
      60,
    );
    await adapter.upsert(
      'token-3',
      { uid: 'uid-3', grantId: 'grant-2' } as any,
      60,
    );

    await adapter.revokeByGrantId('grant-1');

    await expect(adapter.find('token-1')).resolves.toBeUndefined();
    await expect(adapter.find('token-2')).resolves.toBeUndefined();
    await expect(adapter.find('token-3')).resolves.toMatchObject({
      uid: 'uid-3',
    });
  });

  it('negative cache helper는 만료 전까지 miss를 기억한다', async () => {
    await adapter.negativeCacheById('missing-id', 5);
    await adapter.negativeCacheUid('missing-uid', 5);
    await adapter.negativeCacheUserCode('missing-code', 5);

    await expect(adapter.isNegativeCachedById('missing-id')).resolves.toBe(
      true,
    );
    await expect(
      adapter.resolveIdByUid('missing-uid'),
    ).resolves.toBeUndefined();
    await expect(
      adapter.resolveIdByUserCode('missing-code'),
    ).resolves.toBeUndefined();

    redis.advanceTime(6000);

    await expect(adapter.isNegativeCachedById('missing-id')).resolves.toBe(
      false,
    );
  });

  it('같은 kind와 id를 사용하는 다른 테넌트의 키를 격리한다', async () => {
    const tenantA = new RedisAdapter('tenant-a', 'AccessToken', redis as any);
    const tenantB = new RedisAdapter('tenant-b', 'AccessToken', redis as any);

    await tenantA.upsert(
      'shared-token',
      { sub: 'user-a', uid: 'shared-uid', grantId: 'shared-grant' } as any,
      60,
    );
    await tenantB.upsert(
      'shared-token',
      { sub: 'user-b', uid: 'shared-uid', grantId: 'shared-grant' } as any,
      60,
    );
    await tenantA.negativeCacheById('same-missing-id', 60);

    await expect(tenantA.find('shared-token')).resolves.toMatchObject({
      sub: 'user-a',
    });
    await expect(tenantB.find('shared-token')).resolves.toMatchObject({
      sub: 'user-b',
    });
    await expect(tenantB.isNegativeCachedById('same-missing-id')).resolves.toBe(
      false,
    );

    await tenantB.revokeByGrantId('shared-grant');

    await expect(tenantA.findByUid('shared-uid')).resolves.toMatchObject({
      sub: 'user-a',
    });
    await expect(tenantB.find('shared-token')).resolves.toBeUndefined();
  });
});
