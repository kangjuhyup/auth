import { RedisLoginAttemptPolicyAdapter } from '@infrastructure/security/login-attempt/redis-login-attempt-policy.adapter';

function makeConfig(values: Record<string, string>) {
  return {
    get: jest.fn((key: string) => values[key]),
  } as any;
}

function makeRepository(overrides: Record<string, jest.Mock> = {}) {
  return {
    incrementIpCounter: jest.fn().mockResolvedValue(1),
    getIpCounterTtl: jest.fn().mockResolvedValue(60),
    hasLock: jest.fn().mockResolvedValue(false),
    getLockTtl: jest.fn().mockResolvedValue(300),
    incrementFailureCounter: jest.fn().mockResolvedValue(1),
    setLock: jest.fn().mockResolvedValue(undefined),
    clearFailureCounter: jest.fn().mockResolvedValue(undefined),
    clearFailureAndLock: jest.fn().mockResolvedValue(undefined),
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
    const repository = makeRepository();
    const adapter = new RedisLoginAttemptPolicyAdapter(
      repository,
      makeConfig({ LOGIN_RATE_LIMIT_IP_MAX: '10' }),
    );

    await expect(adapter.consumeAttempt(params)).resolves.toEqual({
      allowed: true,
    });

    expect(repository.incrementIpCounter).toHaveBeenCalledWith(params, 60);
    expect(repository.hasLock).toHaveBeenCalledWith(params);
  });

  it('IP 카운터가 한도를 넘으면 rate_limited 결정을 반환한다', async () => {
    const repository = makeRepository({
      incrementIpCounter: jest.fn().mockResolvedValue(11),
      getIpCounterTtl: jest.fn().mockResolvedValue(42),
    });
    const adapter = new RedisLoginAttemptPolicyAdapter(
      repository,
      makeConfig({ LOGIN_RATE_LIMIT_IP_MAX: '10' }),
    );

    await expect(adapter.consumeAttempt(params)).resolves.toEqual({
      allowed: false,
      reason: 'rate_limited',
      retryAfterSec: 42,
    });
    expect(repository.getIpCounterTtl).toHaveBeenCalledWith(params, 60);
    expect(repository.hasLock).not.toHaveBeenCalled();
  });

  it('계정 lock 키가 있으면 temporarily_locked 결정을 반환한다', async () => {
    const repository = makeRepository({
      hasLock: jest.fn().mockResolvedValue(true),
      getLockTtl: jest.fn().mockResolvedValue(300),
    });
    const adapter = new RedisLoginAttemptPolicyAdapter(
      repository,
      makeConfig({}),
    );

    await expect(adapter.consumeAttempt(params)).resolves.toEqual({
      allowed: false,
      reason: 'temporarily_locked',
      retryAfterSec: 300,
    });
  });

  it('실패 횟수가 한도에 도달하면 임시 잠금 키를 설정한다', async () => {
    const repository = makeRepository({
      incrementFailureCounter: jest.fn().mockResolvedValue(5),
    });
    const adapter = new RedisLoginAttemptPolicyAdapter(
      repository,
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
    expect(repository.setLock).toHaveBeenCalledWith(params, 900);
    expect(repository.clearFailureCounter).toHaveBeenCalledWith(params);
  });

  it('성공 시 실패 카운터와 잠금 키를 제거한다', async () => {
    const repository = makeRepository();
    const adapter = new RedisLoginAttemptPolicyAdapter(
      repository,
      makeConfig({}),
    );

    await adapter.recordSuccess(params);

    expect(repository.clearFailureAndLock).toHaveBeenCalledWith(params);
  });
});
