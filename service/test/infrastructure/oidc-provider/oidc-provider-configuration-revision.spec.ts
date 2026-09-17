import { createOidcProviderConfigurationRevisionResolver } from '@infrastructure/oidc-provider/oidc-provider-configuration-revision';

describe('OIDC Provider configuration revision resolver', () => {
  const makeDeps = () => ({
    tenantRepository: {
      findByCode: jest
        .fn()
        .mockImplementation(async (tenantCode: string) =>
          tenantCode === 'tenant-a'
            ? { id: 'tenant-id-a' }
            : tenantCode === 'tenant-b'
              ? { id: 'tenant-id-b' }
              : null,
        ),
    },
    scopeRegistry: {
      listSupportedScopes: jest.fn().mockResolvedValue(['profile', 'openid']),
    },
    grantTypeRegistry: {
      listSupportedGrantTypes: jest
        .fn()
        .mockResolvedValue(['refresh_token', 'authorization_code']),
    },
  });

  it('tenant별 supported scope와 grant type의 순서 독립 fingerprint를 만든다', async () => {
    const deps = makeDeps();
    const resolve = createOidcProviderConfigurationRevisionResolver(
      deps as any,
    );

    const first = await resolve('tenant-a');
    deps.scopeRegistry.listSupportedScopes.mockResolvedValue([
      'openid',
      'profile',
    ]);
    deps.grantTypeRegistry.listSupportedGrantTypes.mockResolvedValue([
      'authorization_code',
      'refresh_token',
    ]);
    const reordered = await resolve('tenant-a');
    const otherTenant = await resolve('tenant-b');

    expect(reordered).toBe(first);
    expect(otherTenant).not.toBe(first);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });

  it('scope 추가·비활성화·삭제 및 grant metadata 변화에 revision이 달라진다', async () => {
    const deps = makeDeps();
    const resolve = createOidcProviderConfigurationRevisionResolver(
      deps as any,
    );
    const initial = await resolve('tenant-a');

    deps.scopeRegistry.listSupportedScopes.mockResolvedValue([
      'openid',
      'profile',
      'offline_access',
    ]);
    const added = await resolve('tenant-a');
    deps.scopeRegistry.listSupportedScopes.mockResolvedValue([
      'openid',
      'profile',
    ]);
    const disabledOrDeleted = await resolve('tenant-a');
    deps.grantTypeRegistry.listSupportedGrantTypes.mockResolvedValue([
      'authorization_code',
    ]);
    const grantChanged = await resolve('tenant-a');

    expect(added).not.toBe(initial);
    expect(disabledOrDeleted).toBe(initial);
    expect(grantChanged).not.toBe(initial);
  });

  it('존재하지 않는 tenant는 revision을 만들지 않는다', async () => {
    const resolve = createOidcProviderConfigurationRevisionResolver(
      makeDeps() as any,
    );

    await expect(resolve('missing')).rejects.toThrow('OIDC tenant not found');
  });
});
