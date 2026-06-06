import { RedisLoginAttemptStore } from '@infrastructure/stores/redis/redis-login-attempt.store';

function makeRedis(overrides: Record<string, jest.Mock> = {}) {
  return {
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    get: jest.fn().mockResolvedValue(null),
    ttl: jest.fn().mockResolvedValue(60),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    ...overrides,
  } as any;
}

const params = {
  tenantId: 'tenant-1',
  username: 'Alice',
  ipAddress: '203.0.113.10',
  scope: 'interaction' as const,
};

describe('RedisLoginAttemptStore', () => {
  it('IP counter를 증가시키고 최초 생성 시 TTL을 설정한다', async () => {
    const redis = makeRedis();
    const store = new RedisLoginAttemptStore(redis);

    await expect(store.incrementIpCounter(params, 60)).resolves.toBe(1);

    expect(redis.incr).toHaveBeenCalledWith(
      expect.stringContaining('login:ip:interaction:'),
    );
    expect(redis.expire).toHaveBeenCalledWith(expect.any(String), 60);
  });

  it('기존 counter를 증가시킬 때는 TTL을 다시 설정하지 않는다', async () => {
    const redis = makeRedis({
      incr: jest.fn().mockResolvedValue(2),
    });
    const store = new RedisLoginAttemptStore(redis);

    await expect(store.incrementFailureCounter(params, 900)).resolves.toBe(2);

    expect(redis.incr).toHaveBeenCalledWith(
      expect.stringContaining('login:failure:interaction:'),
    );
    expect(redis.expire).not.toHaveBeenCalled();
  });

  it('lock 키 존재 여부와 TTL을 조회한다', async () => {
    const redis = makeRedis({
      get: jest.fn().mockResolvedValue('1'),
      ttl: jest.fn().mockResolvedValue(300),
    });
    const store = new RedisLoginAttemptStore(redis);

    await expect(store.hasLock(params)).resolves.toBe(true);
    await expect(store.getLockTtl(params, 900)).resolves.toBe(300);
  });

  it('TTL이 없으면 기본 TTL을 반환한다', async () => {
    const redis = makeRedis({
      ttl: jest.fn().mockResolvedValue(-1),
    });
    const store = new RedisLoginAttemptStore(redis);

    await expect(store.getIpCounterTtl(params, 60)).resolves.toBe(60);
  });

  it('lock 설정과 실패/lock key 정리를 Redis에 위임한다', async () => {
    const redis = makeRedis();
    const store = new RedisLoginAttemptStore(redis);

    await store.setLock(params, 900);
    await store.clearFailureCounter(params);
    await store.clearFailureAndLock(params);

    expect(redis.set).toHaveBeenCalledWith(
      expect.stringContaining('login:lock:interaction:'),
      '1',
      'EX',
      900,
    );
    expect(redis.del).toHaveBeenCalledWith(
      expect.stringContaining('login:failure:interaction:'),
    );
    expect(redis.del).toHaveBeenCalledWith(
      expect.stringContaining('login:failure:interaction:'),
      expect.stringContaining('login:lock:interaction:'),
    );
  });
});
