import { InfrastructureReadinessAdapter } from '@infrastructure/observability/infrastructure-readiness.adapter';

describe('InfrastructureReadinessAdapter', () => {
  function createAdapter(
    overrides: {
      dbError?: Error;
      redisPong?: string;
      redisError?: Error;
      configError?: Error;
    } = {},
  ) {
    const orm = {
      em: {
        getConnection: () => ({
          execute: jest.fn().mockImplementation(() => {
            if (overrides.dbError) throw overrides.dbError;
            return Promise.resolve([{ ok: 1 }]);
          }),
        }),
      },
    };
    const redis = {
      ping: jest.fn().mockImplementation(() => {
        if (overrides.redisError) throw overrides.redisError;
        return Promise.resolve(overrides.redisPong ?? 'PONG');
      }),
    };
    const config = {
      getOrThrow: jest.fn().mockImplementation((key: string) => {
        if (overrides.configError) throw overrides.configError;
        return key === 'OIDC_ISSUER'
          ? 'https://auth.example.com'
          : '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      }),
    };

    return new InfrastructureReadinessAdapter(
      orm as any,
      redis as any,
      {} as any,
      config as any,
    );
  }

  it('DB, Redis, JWKS, OIDC provider가 준비되면 모두 ready를 반환한다', async () => {
    const result = await createAdapter().check();

    expect(result).toHaveLength(4);
    expect(result.map((component) => component.status)).toEqual([
      'ready',
      'ready',
      'ready',
      'ready',
    ]);
  });

  it('실패한 component는 not_ready와 reason을 반환한다', async () => {
    const result = await createAdapter({
      redisPong: 'NOPE',
    }).check();

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'redis',
          status: 'not_ready',
          reason: 'Redis ping failed',
        }),
      ]),
    );
  });
});
