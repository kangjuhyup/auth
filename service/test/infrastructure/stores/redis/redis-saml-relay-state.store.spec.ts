import { RedisSamlRelayStateStore } from '@infrastructure/stores/redis/redis-saml-relay-state.store';

function makeRedis(overrides: Record<string, jest.Mock> = {}) {
  return {
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue('1'),
    del: jest.fn().mockResolvedValue(1),
    ...overrides,
  } as any;
}

const relayState = {
  tenantId: 'tenant-1',
  provider: 'okta',
  relayState: 'uid:uid-1:nonce',
};

describe('RedisSamlRelayStateStore', () => {
  it('RelayState를 TTL과 함께 저장한다', async () => {
    const redis = makeRedis();
    const store = new RedisSamlRelayStateStore(redis);

    await store.save(relayState, 600);

    expect(redis.set).toHaveBeenCalledWith(
      'saml:relay:tenant-1:okta:uid:uid-1:nonce',
      '1',
      'EX',
      600,
    );
  });

  it('RelayState 존재 여부를 조회한다', async () => {
    const redis = makeRedis({
      get: jest.fn().mockResolvedValue(null),
    });
    const store = new RedisSamlRelayStateStore(redis);

    await expect(store.exists(relayState)).resolves.toBe(false);
    expect(redis.get).toHaveBeenCalledWith(
      'saml:relay:tenant-1:okta:uid:uid-1:nonce',
    );
  });

  it('RelayState를 삭제한다', async () => {
    const redis = makeRedis();
    const store = new RedisSamlRelayStateStore(redis);

    await store.delete(relayState);

    expect(redis.del).toHaveBeenCalledWith(
      'saml:relay:tenant-1:okta:uid:uid-1:nonce',
    );
  });
});
