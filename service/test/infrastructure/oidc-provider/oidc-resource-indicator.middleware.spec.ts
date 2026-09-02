import { registerOidcResourceIndicatorNormalization } from '@infrastructure/oidc-provider/oidc-resource-indicator.middleware';

describe('OIDC resource indicator normalization middleware', () => {
  it('authorization resource path/query를 provider parameter assembly 전에 origin으로 정규화한다', async () => {
    let middleware:
      | ((ctx: any, next: () => Promise<void>) => Promise<void>)
      | undefined;
    const provider = {
      use: jest.fn((candidate) => {
        middleware = candidate;
      }),
    };
    registerOidcResourceIndicatorNormalization(provider as any);
    const next = jest.fn().mockResolvedValue(undefined);
    const ctx = {
      method: 'GET',
      path: '/auth',
      query: {
        client_id: 'e-vote',
        resource: 'https://vote-api.example.com/votes?status=open',
      },
    };

    await middleware!(ctx, next);

    expect(ctx.query).toEqual({
      client_id: 'e-vote',
      resource: 'https://vote-api.example.com',
    });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('복수 resource를 각각 정규화하고 잘못된 resource는 provider 검증에 맡긴다', async () => {
    let middleware:
      | ((ctx: any, next: () => Promise<void>) => Promise<void>)
      | undefined;
    const provider = { use: jest.fn((candidate) => (middleware = candidate)) };
    registerOidcResourceIndicatorNormalization(provider as any);
    const next = jest.fn().mockResolvedValue(undefined);
    const ctx = {
      method: 'GET',
      path: '/auth',
      query: {
        resource: [
          'https://vote-api.example.com/a',
          'https://profile-api.example.com/b',
        ],
      },
    };

    await middleware!(ctx, next);
    expect(ctx.query.resource).toEqual([
      'https://vote-api.example.com',
      'https://profile-api.example.com',
    ]);

    ctx.query.resource = 'http://localhost/private';
    await middleware!(ctx, next);
    expect(ctx.query.resource).toBe('http://localhost/private');
  });
});
