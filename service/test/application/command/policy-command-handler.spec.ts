import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PolicyCommandHandler } from '@application/commands/handlers/policy-command.handler';
import type { TransactionManagerPort } from '@application/ports/transaction-manager.port';
import type { TenantConfigRepository, TenantRepository } from '@domain/repositories';
import { TenantModel } from '@domain/models/tenant';
import { TenantConfigModel } from '@domain/models/tenant-config';

function makeTenant(id = 'tenant-1'): TenantModel {
  const tenant = new TenantModel({ code: 'acme', name: 'Acme Corp' });
  tenant.setPersistence(id, new Date(), new Date());
  return tenant;
}

function makeTenantConfig(): TenantConfigModel {
  return new TenantConfigModel({
    tenantId: 'tenant-1',
    signupPolicy: 'invite',
    requirePhoneVerify: true,
    brandName: 'Acme',
    accessTokenTtlSec: 120,
    refreshTokenTtlSec: 240,
    extra: { policies: { allowSignup: false, pkceRequired: true } },
  });
}

function createMockTenantRepo(): jest.Mocked<TenantRepository> {
  return {
    findByCode: jest.fn().mockResolvedValue(makeTenant()),
    findById: jest.fn().mockResolvedValue(makeTenant()),
    list: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    save: jest.fn().mockResolvedValue(makeTenant()),
    delete: jest.fn().mockResolvedValue(undefined),
  };
}

function createMockTenantConfigRepo(): jest.Mocked<TenantConfigRepository> {
  return {
    findByTenantId: jest.fn().mockResolvedValue(makeTenantConfig()),
    save: jest.fn().mockImplementation(async (config: TenantConfigModel) => config),
  };
}

function createMockTransactionManager(): jest.Mocked<TransactionManagerPort> {
  return {
    runInTransaction: jest.fn().mockImplementation(async (work: () => Promise<unknown>) => work()),
  } as any;
}

describe('PolicyCommandHandler', () => {
  let handler: PolicyCommandHandler;
  let tenantRepo: jest.Mocked<TenantRepository>;
  let tenantConfigRepo: jest.Mocked<TenantConfigRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    tenantRepo = createMockTenantRepo();
    tenantConfigRepo = createMockTenantConfigRepo();
    handler = new PolicyCommandHandler(
      tenantRepo,
      tenantConfigRepo,
      createMockTransactionManager(),
    );
  });

  describe('updatePolicies', () => {
    it('payload가 객체가 아니면 BadRequestException을 던진다', async () => {
      await expect(
        handler.updatePolicies('tenant-1', null as any),
      ).rejects.toThrow(BadRequestException);

      await expect(
        handler.updatePolicies('tenant-1', [] as any),
      ).rejects.toThrow(BadRequestException);

      expect(tenantRepo.findById).not.toHaveBeenCalled();
      expect(tenantConfigRepo.save).not.toHaveBeenCalled();
    });

    it('테넌트가 없으면 NotFoundException을 던진다', async () => {
      tenantRepo.findById.mockResolvedValue(null);

      await expect(
        handler.updatePolicies('tenant-1', { pkceRequired: true }),
      ).rejects.toThrow(NotFoundException);

      expect(tenantConfigRepo.findByTenantId).not.toHaveBeenCalled();
      expect(tenantConfigRepo.save).not.toHaveBeenCalled();
    });

    it('기존 config가 있으면 policies를 병합해 저장한다', async () => {
      const existingConfig = makeTenantConfig();
      tenantConfigRepo.findByTenantId.mockResolvedValue(existingConfig);

      await handler.updatePolicies('tenant-1', {
        requireMfa: true,
        allowedGrantTypes: ['authorization_code'],
      });

      expect(tenantRepo.findById).toHaveBeenCalledWith('tenant-1');
      expect(tenantConfigRepo.findByTenantId).toHaveBeenCalledWith('tenant-1');
      expect(tenantConfigRepo.save).toHaveBeenCalledTimes(1);

      const savedConfig = tenantConfigRepo.save.mock.calls[0][0];
      expect(savedConfig).toBe(existingConfig);
      expect(savedConfig.getPolicies()).toEqual({
        requireMfa: true,
        allowedGrantTypes: ['authorization_code'],
      });
      expect(savedConfig.signupPolicy).toBe('invite');
      expect(savedConfig.requirePhoneVerify).toBe(true);
    });

    it('config가 없으면 기본 TenantConfig를 생성해 저장한다', async () => {
      tenantConfigRepo.findByTenantId.mockResolvedValue(null);

      await handler.updatePolicies('tenant-1', {
        enforcePkce: true,
      });

      expect(tenantConfigRepo.save).toHaveBeenCalledTimes(1);
      const savedConfig = tenantConfigRepo.save.mock.calls[0][0];

      expect(savedConfig).toBeInstanceOf(TenantConfigModel);
      expect(savedConfig.tenantId).toBe('tenant-1');
      expect(savedConfig.signupPolicy).toBe('open');
      expect(savedConfig.requirePhoneVerify).toBe(false);
      expect(savedConfig.brandName).toBeNull();
      expect(savedConfig.accessTokenTtlSec).toBe(60 * 60);
      expect(savedConfig.refreshTokenTtlSec).toBe(14 * 24 * 60 * 60);
      expect(savedConfig.getPolicies()).toEqual({
        enforcePkce: true,
      });
    });
  });
});
