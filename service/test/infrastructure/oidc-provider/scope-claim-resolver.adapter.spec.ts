import { OidcScopeClaimResolverAdapter } from '@infrastructure/oidc-provider/scope-claim-resolver.adapter';

describe('OidcScopeClaimResolverAdapter', () => {
  it('scope claim key에 해당하는 claim만 반환한다', async () => {
    const adapter = new OidcScopeClaimResolverAdapter();

    await expect(
      adapter.resolve({
        tenantId: 'tenant-1',
        subject: 'user-1',
        requestedScopes: ['openid', 'email'],
        claimKeys: ['email'],
        baseClaims: {
          sub: 'user-1',
          username: 'alice',
          email: 'alice@example.com',
          email_verified: true,
          phone: '+821012345678',
          phone_verified: false,
        },
      }),
    ).resolves.toEqual({
      sub: 'user-1',
      email: 'alice@example.com',
      email_verified: true,
    });
  });

  it('알 수 없는 claim key는 무시한다', async () => {
    const adapter = new OidcScopeClaimResolverAdapter();

    await expect(
      adapter.resolve({
        tenantId: 'tenant-1',
        subject: 'user-1',
        requestedScopes: ['orders:read'],
        claimKeys: ['orders'],
        baseClaims: { sub: 'user-1' },
      }),
    ).resolves.toEqual({ sub: 'user-1' });
  });

  it('custom scope claim strategy를 통해 claim을 확장한다', async () => {
    const adapter = new OidcScopeClaimResolverAdapter([
      {
        supports: (claimKey) => claimKey === 'department',
        resolve: ({ tenantId, subject }) => ({
          department: `${tenantId}:${subject}:engineering`,
        }),
      },
    ]);

    await expect(
      adapter.resolve({
        tenantId: 'tenant-1',
        subject: 'user-1',
        requestedScopes: ['department'],
        claimKeys: ['department'],
        baseClaims: { sub: 'user-1' },
      }),
    ).resolves.toEqual({
      sub: 'user-1',
      department: 'tenant-1:user-1:engineering',
    });
  });
});
