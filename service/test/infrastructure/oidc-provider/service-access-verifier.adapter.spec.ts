import { ServiceAccessVerifierAdapter } from '@infrastructure/oidc-provider/service-access-verifier.adapter';

describe('ServiceAccessVerifierAdapter', () => {
  const future = () => Math.floor(Date.now() / 1000) + 60;

  function setup(payload: Record<string, unknown> | undefined) {
    const provider = {
      ClientCredentials: { find: jest.fn().mockResolvedValue(payload) },
    };
    const registry = { get: jest.fn().mockResolvedValue(provider) };
    const tenantRepository = {
      findById: jest.fn().mockResolvedValue({ id: 'tenant-1', code: 'acme' }),
    };
    const clientRepository = {
      findByClientId: jest.fn().mockResolvedValue({
        tenantId: 'tenant-1',
        clientId: 'provisioner',
        enabled: true,
        type: 'service',
        grantTypes: ['client_credentials'],
      }),
    };
    const adapter = new ServiceAccessVerifierAdapter(
      registry as any,
      tenantRepository as any,
      clientRepository as any,
    );
    return { adapter, provider, clientRepository };
  }

  it('정확한 tenant와 최소 scope가 있는 service client token만 허용한다', async () => {
    const { adapter } = setup({
      clientId: 'provisioner',
      scope: 'auth.user.provision',
      payload: {
        clientId: 'provisioner',
        tenant_id: 'tenant-1',
        scope: 'auth.user.provision',
        exp: future(),
      },
    });

    await expect(adapter.verify('tenant-1', 'opaque-token')).resolves.toEqual({
      clientId: 'provisioner',
      scope: 'auth.user.provision',
    });
  });

  it('provider가 extra에 보관한 tenant claim을 검증한다', async () => {
    const { adapter } = setup({
      clientId: 'provisioner',
      scope: 'auth.user.provision',
      payload: {
        clientId: 'provisioner',
        scope: 'auth.user.provision',
        exp: future(),
        extra: { tenant_id: 'tenant-1' },
      },
    });

    await expect(adapter.verify('tenant-1', 'opaque-token')).resolves.toEqual({
      clientId: 'provisioner',
      scope: 'auth.user.provision',
    });
  });

  it('node-oidc-provider의 직접적인 ClientCredentials 모델 필드를 검증한다', async () => {
    const { adapter } = setup({
      clientId: 'provisioner',
      scope: 'auth.user.provision',
      exp: future(),
      extra: { tenant_id: 'tenant-1' },
    });

    await expect(adapter.verify('tenant-1', 'opaque-token')).resolves.toEqual({
      clientId: 'provisioner',
      scope: 'auth.user.provision',
    });
  });

  it.each([
    ['missing token', undefined],
    [
      'wrong tenant',
      {
        clientId: 'provisioner',
        payload: {
          tenant_id: 'tenant-2',
          scope: 'auth.user.provision',
          exp: future(),
        },
      },
    ],
    [
      'missing tenant',
      {
        clientId: 'provisioner',
        payload: { scope: 'auth.user.provision', exp: future() },
      },
    ],
    [
      'wrong tenant in extra',
      {
        clientId: 'provisioner',
        payload: {
          scope: 'auth.user.provision',
          exp: future(),
          extra: { tenant_id: 'tenant-2' },
        },
      },
    ],
    [
      'expired',
      {
        clientId: 'provisioner',
        payload: {
          tenant_id: 'tenant-1',
          scope: 'auth.user.provision',
          exp: 1,
        },
      },
    ],
    [
      'missing scope',
      {
        clientId: 'provisioner',
        payload: { tenant_id: 'tenant-1', scope: 'openid', exp: future() },
      },
    ],
  ])('%s를 거부한다', async (_name, token) => {
    const { adapter } = setup(token as any);
    await expect(adapter.verify('tenant-1', 'opaque-token')).rejects.toThrow();
  });

  it('disabled 또는 non-service client를 거부한다', async () => {
    const { adapter, clientRepository } = setup({
      clientId: 'provisioner',
      payload: {
        tenant_id: 'tenant-1',
        scope: 'auth.user.provision',
        exp: future(),
      },
    });
    clientRepository.findByClientId.mockResolvedValue({
      enabled: false,
      type: 'public',
      grantTypes: [],
    });

    await expect(adapter.verify('tenant-1', 'opaque-token')).rejects.toThrow();
  });
});
