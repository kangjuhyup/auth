import { AdminAuditLogController } from '@presentation/controllers/admin/audit-log.controller';
import { AdminClientController } from '@presentation/controllers/admin/client.controller';
import { AdminKeyController } from '@presentation/controllers/admin/key.controller';
import { AdminPermissionController } from '@presentation/controllers/admin/permission.controller';
import { AdminPolicyController } from '@presentation/controllers/admin/policy.controller';
import { AdminTenantController } from '@presentation/controllers/admin/tenant.controller';
import {
  makePaginatedResult,
  makePaginationQuery,
  makeTenantContext,
} from '../support/controller-test-helpers';

describe('관리자 단순 컨트롤러', () => {
  const tenant = makeTenantContext();
  const query = makePaginationQuery({ page: 2, limit: 10 });

  describe('AdminAuditLogController', () => {
    it('list는 tenant.id와 query를 queryPort에 전달한다', async () => {
      const queryPort = {
        getAuditLogs: jest.fn().mockResolvedValue(
          makePaginatedResult([{ id: 'log-1' } as any], 1),
        ),
      } as any;
      const controller = new AdminAuditLogController(queryPort);

      await expect(controller.list(tenant, query)).resolves.toEqual(
        makePaginatedResult([{ id: 'log-1' } as any], 1),
      );
      expect(queryPort.getAuditLogs).toHaveBeenCalledWith(tenant.id, query);
    });
  });

  describe('AdminClientController', () => {
    let controller: AdminClientController;
    let commandPort: any;
    let queryPort: any;

    beforeEach(() => {
      commandPort = {
        createClient: jest.fn(),
        updateClient: jest.fn(),
        deleteClient: jest.fn(),
      };
      queryPort = {
        getClients: jest.fn(),
        getClient: jest.fn(),
      };
      controller = new AdminClientController(commandPort, queryPort);
    });

    it('list는 tenant.id와 query를 queryPort에 전달한다', async () => {
      const result = makePaginatedResult([{ id: 'client-1' } as any], 1);
      queryPort.getClients.mockResolvedValue(result);

      await expect(controller.list(tenant, query)).resolves.toBe(result);
      expect(queryPort.getClients).toHaveBeenCalledWith(tenant.id, query);
    });

    it('get은 tenant.id와 id를 queryPort에 전달한다', async () => {
      const result = { id: 'client-1' } as any;
      queryPort.getClient.mockResolvedValue(result);

      await expect(controller.get(tenant, 'client-1')).resolves.toBe(result);
      expect(queryPort.getClient).toHaveBeenCalledWith(tenant.id, 'client-1');
    });

    it('create는 tenant.id와 dto를 commandPort에 전달한다', async () => {
      const dto = { clientId: 'web-app', name: 'Web App' } as any;
      const result = { id: 'client-1' };
      commandPort.createClient.mockResolvedValue(result);

      await expect(controller.create(tenant, dto)).resolves.toBe(result);
      expect(commandPort.createClient).toHaveBeenCalledWith(tenant.id, dto);
    });

    it('update는 tenant.id와 id, dto를 commandPort에 전달한다', async () => {
      const dto = { name: 'Updated App' } as any;
      commandPort.updateClient.mockResolvedValue(undefined);

      await expect(
        controller.update(tenant, 'client-1', dto),
      ).resolves.toBeUndefined();
      expect(commandPort.updateClient).toHaveBeenCalledWith(
        tenant.id,
        'client-1',
        dto,
      );
    });

    it('delete는 tenant.id와 id를 commandPort에 전달한다', async () => {
      commandPort.deleteClient.mockResolvedValue(undefined);

      await expect(controller.delete(tenant, 'client-1')).resolves.toBeUndefined();
      expect(commandPort.deleteClient).toHaveBeenCalledWith(
        tenant.id,
        'client-1',
      );
    });
  });

  describe('AdminKeyController', () => {
    it('list는 tenant.id를 queryPort에 전달한다', async () => {
      const commandPort = { rotateKeys: jest.fn() } as any;
      const queryPort = {
        getKeys: jest.fn().mockResolvedValue([{ kid: 'key-1' }]),
      } as any;
      const controller = new AdminKeyController(commandPort, queryPort);

      await expect(controller.list(tenant)).resolves.toEqual([{ kid: 'key-1' }]);
      expect(queryPort.getKeys).toHaveBeenCalledWith(tenant.id);
    });

    it('rotate는 tenant.id를 commandPort에 전달한다', async () => {
      const commandPort = { rotateKeys: jest.fn().mockResolvedValue(undefined) } as any;
      const queryPort = { getKeys: jest.fn() } as any;
      const controller = new AdminKeyController(commandPort, queryPort);

      await expect(controller.rotate(tenant)).resolves.toBeUndefined();
      expect(commandPort.rotateKeys).toHaveBeenCalledWith(tenant.id);
    });
  });

  describe('AdminPermissionController', () => {
    let controller: AdminPermissionController;
    let commandPort: any;
    let queryPort: any;

    beforeEach(() => {
      commandPort = {
        createPermission: jest.fn(),
        updatePermission: jest.fn(),
        deletePermission: jest.fn(),
      };
      queryPort = {
        getPermissions: jest.fn(),
        getPermission: jest.fn(),
      };
      controller = new AdminPermissionController(commandPort, queryPort);
    });

    it('list는 tenant.id와 query를 queryPort에 전달한다', async () => {
      const result = makePaginatedResult([{ id: 'perm-1' } as any], 1);
      queryPort.getPermissions.mockResolvedValue(result);

      await expect(controller.list(tenant, query)).resolves.toBe(result);
      expect(queryPort.getPermissions).toHaveBeenCalledWith(tenant.id, query);
    });

    it('get은 tenant.id와 id를 queryPort에 전달한다', async () => {
      const result = { id: 'perm-1' } as any;
      queryPort.getPermission.mockResolvedValue(result);

      await expect(controller.get(tenant, 'perm-1')).resolves.toBe(result);
      expect(queryPort.getPermission).toHaveBeenCalledWith(tenant.id, 'perm-1');
    });

    it('create는 tenant.id와 dto를 commandPort에 전달한다', async () => {
      const dto = { code: 'articles:read' } as any;
      const result = { id: 'perm-1' };
      commandPort.createPermission.mockResolvedValue(result);

      await expect(controller.create(tenant, dto)).resolves.toBe(result);
      expect(commandPort.createPermission).toHaveBeenCalledWith(tenant.id, dto);
    });

    it('update는 tenant.id와 id, dto를 commandPort에 전달한다', async () => {
      const dto = { description: 'updated' } as any;
      commandPort.updatePermission.mockResolvedValue(undefined);

      await expect(
        controller.update(tenant, 'perm-1', dto),
      ).resolves.toBeUndefined();
      expect(commandPort.updatePermission).toHaveBeenCalledWith(
        tenant.id,
        'perm-1',
        dto,
      );
    });

    it('delete는 tenant.id와 id를 commandPort에 전달한다', async () => {
      commandPort.deletePermission.mockResolvedValue(undefined);

      await expect(controller.delete(tenant, 'perm-1')).resolves.toBeUndefined();
      expect(commandPort.deletePermission).toHaveBeenCalledWith(
        tenant.id,
        'perm-1',
      );
    });
  });

  describe('AdminPolicyController', () => {
    it('list는 tenant.id를 queryPort에 전달한다', async () => {
      const commandPort = { updatePolicies: jest.fn() } as any;
      const queryPort = {
        getPolicies: jest.fn().mockResolvedValue({ requireMfa: true }),
      } as any;
      const controller = new AdminPolicyController(commandPort, queryPort);

      await expect(controller.list(tenant)).resolves.toEqual({
        requireMfa: true,
      });
      expect(queryPort.getPolicies).toHaveBeenCalledWith(tenant.id);
    });

    it('update는 tenant.id와 body를 commandPort에 전달한다', async () => {
      const commandPort = {
        updatePolicies: jest.fn().mockResolvedValue(undefined),
      } as any;
      const queryPort = { getPolicies: jest.fn() } as any;
      const controller = new AdminPolicyController(commandPort, queryPort);
      const policies = { requireMfa: true };

      await expect(controller.update(tenant, policies)).resolves.toBeUndefined();
      expect(commandPort.updatePolicies).toHaveBeenCalledWith(
        tenant.id,
        policies,
      );
    });
  });

  describe('AdminTenantController', () => {
    let controller: AdminTenantController;
    let commandPort: any;
    let queryPort: any;

    beforeEach(() => {
      commandPort = {
        createTenant: jest.fn(),
        updateTenant: jest.fn(),
        deleteTenant: jest.fn(),
      };
      queryPort = {
        getTenants: jest.fn(),
        getTenant: jest.fn(),
      };
      controller = new AdminTenantController(commandPort, queryPort);
    });

    it('list는 query를 queryPort에 전달한다', async () => {
      const result = makePaginatedResult([{ id: 'tenant-1' } as any], 1);
      queryPort.getTenants.mockResolvedValue(result);

      await expect(controller.list(query)).resolves.toBe(result);
      expect(queryPort.getTenants).toHaveBeenCalledWith(query);
    });

    it('get은 id를 queryPort에 전달한다', async () => {
      const result = { id: 'tenant-1' } as any;
      queryPort.getTenant.mockResolvedValue(result);

      await expect(controller.get('tenant-1')).resolves.toBe(result);
      expect(queryPort.getTenant).toHaveBeenCalledWith('tenant-1');
    });

    it('create는 dto를 commandPort에 전달한다', async () => {
      const dto = { code: 'acme', name: 'Acme' } as any;
      const result = { id: 'tenant-1' };
      commandPort.createTenant.mockResolvedValue(result);

      await expect(controller.create(dto)).resolves.toBe(result);
      expect(commandPort.createTenant).toHaveBeenCalledWith(dto);
    });

    it('update는 id와 dto를 commandPort에 전달한다', async () => {
      const dto = { name: 'New Name' } as any;
      commandPort.updateTenant.mockResolvedValue(undefined);

      await expect(controller.update('tenant-1', dto)).resolves.toBeUndefined();
      expect(commandPort.updateTenant).toHaveBeenCalledWith('tenant-1', dto);
    });

    it('delete는 id를 commandPort에 전달한다', async () => {
      commandPort.deleteTenant.mockResolvedValue(undefined);

      await expect(controller.delete('tenant-1')).resolves.toBeUndefined();
      expect(commandPort.deleteTenant).toHaveBeenCalledWith('tenant-1');
    });
  });
});
