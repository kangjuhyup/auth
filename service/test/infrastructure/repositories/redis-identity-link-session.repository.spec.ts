import { RedisIdentityLinkSessionRepository } from '@infrastructure/repositories/redis-identity-link-session.repository';
import type { IdentityLinkSession } from '@application/ports/identity-link-session.port';

function makeRedis(overrides: Record<string, jest.Mock> = {}) {
  return {
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
    ...overrides,
  };
}

describe('RedisIdentityLinkSessionRepository', () => {
  const session: IdentityLinkSession = {
    state: 'state-1',
    tenantId: 'tenant-1',
    tenantCode: 'acme',
    userId: 'user-1',
    provider: 'google',
    redirectUri:
      'https://auth.example/t/acme/auth/identity-links/google/callback',
    returnTo: 'https://app.example/security',
    createdAt: '2026-05-24T00:00:00.000Z',
  };

  it('create는 state key에 TTL과 함께 세션을 저장한다', async () => {
    const redis = makeRedis();
    const repository = new RedisIdentityLinkSessionRepository(redis as any);

    await repository.create(session, 300);

    expect(redis.set).toHaveBeenCalledWith(
      'identity-link:state:state-1',
      JSON.stringify(session),
      'EX',
      300,
    );
  });

  it('consume은 세션을 조회한 뒤 state key를 삭제한다', async () => {
    const redis = makeRedis({
      get: jest.fn().mockResolvedValue(JSON.stringify(session)),
    });
    const repository = new RedisIdentityLinkSessionRepository(redis as any);

    await expect(repository.consume('state-1')).resolves.toEqual(session);
    expect(redis.del).toHaveBeenCalledWith('identity-link:state:state-1');
  });

  it('consume은 없는 state면 null을 반환하고 삭제하지 않는다', async () => {
    const redis = makeRedis();
    const repository = new RedisIdentityLinkSessionRepository(redis as any);

    await expect(repository.consume('missing')).resolves.toBeNull();
    expect(redis.del).not.toHaveBeenCalled();
  });
});
