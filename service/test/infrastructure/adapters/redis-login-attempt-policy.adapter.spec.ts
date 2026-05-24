import { RedisLoginAttemptPolicyAdapter } from '@infrastructure/adapters/redis-login-attempt-policy.adapter';

function makeConfig(values: Record<string, string>) {
  return {
    get: jest.fn((key: string) => values[key]),
  } as any;
}

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

describe('RedisLoginAttemptPolicyAdapter', () => {
  it('IP 카운터가 한도 이하면 로그인 시도를 허용한다', async () => {
    const redis = makeRedis();
    const adapter = new RedisLoginAttemptPolicyAdapter(
      redis,
      makeConfig({ LOGIN_RATE_LIMIT_IP_MAX: '10' }),
    );

    await expect(adapter.consumeAttempt(params)).resolves.toEqual({
      allowed: true,
    });

    expect(redis.incr).toHaveBeenCalledWith(
      expect.stringContaining('login:ip:interaction:'),
    );
    expect(redis.expire).toHaveBeenCalledWith(expect.any(String), 60);
  });

  it('IP 카운터가 한도를 넘으면 rate_limited 결정을 반환한다', async () => {
    const redis = makeRedis({
      incr: jest.fn().mockResolvedValue(11),
      ttl: jest.fn().mockResolvedValue(42),
    });
    const adapter = new RedisLoginAttemptPolicyAdapter(
      redis,
      makeConfig({ LOGIN_RATE_LIMIT_IP_MAX: '10' }),
    );

    await expect(adapter.consumeAttempt(params)).resolves.toEqual({
      allowed: false,
      reason: 'rate_limited',
      retryAfterSec: 42,
    });
  });

  it('계정 lock 키가 있으면 temporarily_locked 결정을 반환한다', async () => {
    const redis = makeRedis({
      get: jest.fn().mockResolvedValue('1'),
      ttl: jest.fn().mockResolvedValue(300),
    });
    const adapter = new RedisLoginAttemptPolicyAdapter(redis, makeConfig({}));

    await expect(adapter.consumeAttempt(params)).resolves.toEqual({
      allowed: false,
      reason: 'temporarily_locked',
      retryAfterSec: 300,
    });
  });

  it('실패 횟수가 한도에 도달하면 임시 잠금 키를 설정한다', async () => {
    const redis = makeRedis({
      incr: jest.fn().mockResolvedValue(5),
    });
    const adapter = new RedisLoginAttemptPolicyAdapter(
      redis,
      makeConfig({
        LOGIN_FAILURE_MAX: '5',
        LOGIN_LOCK_TTL_SEC: '900',
      }),
    );

    await expect(adapter.recordFailure(params)).resolves.toEqual({
      failureCount: 5,
      temporarilyLocked: true,
      retryAfterSec: 900,
    });
    expect(redis.set).toHaveBeenCalledWith(
      expect.stringContaining('login:lock:interaction:'),
      '1',
      'EX',
      900,
    );
    expect(redis.del).toHaveBeenCalledWith(
      expect.stringContaining('login:failure:interaction:'),
    );
  });

  it('성공 시 실패 카운터와 잠금 키를 제거한다', async () => {
    const redis = makeRedis();
    const adapter = new RedisLoginAttemptPolicyAdapter(redis, makeConfig({}));

    await adapter.recordSuccess(params);

    expect(redis.del).toHaveBeenCalledWith(
      expect.stringContaining('login:failure:interaction:'),
      expect.stringContaining('login:lock:interaction:'),
    );
  });
});
