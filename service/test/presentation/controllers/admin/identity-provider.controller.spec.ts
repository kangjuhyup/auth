import { AdminIdentityProviderController } from '@presentation/controllers/admin/identity-provider.controller';

describe('AdminIdentityProviderController', () => {
  const tenant = { id: 'tenant-1', code: 'acme' } as any;
  const query = { page: 1, limit: 20 } as any;
  const dto = {
    provider: 'google',
    displayName: 'Google',
    clientId: 'client-id',
    redirectUri: 'https://app.example.com/callback',
  } as any;

  function makeController() {
    const commandPort = {
      createIdentityProvider: jest.fn().mockResolvedValue({ id: 'idp-1' }),
      updateIdentityProvider: jest.fn().mockResolvedValue(undefined),
      deleteIdentityProvider: jest.fn().mockResolvedValue(undefined),
    };
    const queryPort = {
      getIdentityProviders: jest
        .fn()
        .mockResolvedValue({ items: [], total: 0 }),
      getIdentityProvider: jest.fn().mockResolvedValue({ id: 'idp-1' }),
    };
    return {
      controller: new AdminIdentityProviderController(
        commandPort as any,
        queryPort as any,
      ),
      commandPort,
      queryPort,
    };
  }

  it('list/get은 AdminQueryPort에 위임한다', async () => {
    const { controller, queryPort } = makeController();

    await controller.list(tenant, query);
    await controller.get(tenant, 'idp-1');

    expect(queryPort.getIdentityProviders).toHaveBeenCalledWith(
      'tenant-1',
      query,
    );
    expect(queryPort.getIdentityProvider).toHaveBeenCalledWith(
      'tenant-1',
      'idp-1',
    );
  });

  it('create/update/delete는 auditContext 없이 command port에 위임한다', async () => {
    const { controller, commandPort } = makeController();

    await controller.create(tenant, dto);
    await controller.update(tenant, 'idp-1', { displayName: 'New' } as any);
    await controller.delete(tenant, 'idp-1');

    expect(commandPort.createIdentityProvider).toHaveBeenCalledWith(
      'tenant-1',
      dto,
    );
    expect(commandPort.updateIdentityProvider).toHaveBeenCalledWith(
      'tenant-1',
      'idp-1',
      { displayName: 'New' },
    );
    expect(commandPort.deleteIdentityProvider).toHaveBeenCalledWith(
      'tenant-1',
      'idp-1',
    );
  });

  it('auditContext가 있으면 command port에 함께 전달한다', async () => {
    const { controller, commandPort } = makeController();
    const auditContext = { actorUserId: 'admin-1', correlationId: 'req-1' };

    await controller.create(tenant, dto, auditContext);
    await controller.update(
      tenant,
      'idp-1',
      { enabled: false } as any,
      auditContext,
    );
    await controller.delete(tenant, 'idp-1', auditContext);

    expect(commandPort.createIdentityProvider).toHaveBeenCalledWith(
      'tenant-1',
      dto,
      auditContext,
    );
    expect(commandPort.updateIdentityProvider).toHaveBeenCalledWith(
      'tenant-1',
      'idp-1',
      { enabled: false },
      auditContext,
    );
    expect(commandPort.deleteIdentityProvider).toHaveBeenCalledWith(
      'tenant-1',
      'idp-1',
      auditContext,
    );
  });
});
