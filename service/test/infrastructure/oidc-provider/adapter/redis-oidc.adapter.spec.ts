import { RedisAdapter } from '@infrastructure/oidc-provider/adapters/redis-oidc.adapter';
import { InMemoryRedis } from './support/in-memory-stores';

describe('RedisAdapter integration', () => {
  let redis: InMemoryRedis;
  let adapter: RedisAdapter;

  beforeEach(() => {
    redis = new InMemoryRedis();
    adapter = new RedisAdapter('AccessToken', redis as any);
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
    await expect(redis.smembers('oidc:AccessToken:grant:grant-1')).resolves.toEqual([
      'token-1',
    ]);
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
    await expect(redis.smembers('oidc:AccessToken:grant:grant-1')).resolves.toEqual(
      [],
    );
  });

  it('consume 하면 TTL을 유지하면서 consumed 플래그를 추가한다', async () => {
    await adapter.upsert(
      'token-1',
      { sub: 'user-1', uid: 'uid-1' } as any,
      30,
    );

    redis.advanceTime(5000);
    const ttlBefore = await redis.ttl('oidc:AccessToken:token-1');

    await adapter.consume('token-1');

    const ttlAfter = await redis.ttl('oidc:AccessToken:token-1');
    expect(ttlBefore).toBeGreaterThan(0);
    expect(ttlAfter).toBeGreaterThan(0);
    expect(ttlAfter).toBeLessThanOrEqual(ttlBefore);
    await expect(adapter.find('token-1')).resolves.toMatchObject({
      consumed: true,
      sub: 'user-1',
    });
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
    await expect(redis.smembers('oidc:AccessToken:grant:grant-1')).resolves.toEqual(
      [],
    );
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

    await expect(adapter.isNegativeCachedById('missing-id')).resolves.toBe(true);
    await expect(adapter.resolveIdByUid('missing-uid')).resolves.toBeUndefined();
    await expect(adapter.resolveIdByUserCode('missing-code')).resolves.toBeUndefined();

    redis.advanceTime(6000);

    await expect(adapter.isNegativeCachedById('missing-id')).resolves.toBe(false);
  });
});
