import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ScopeCommandHandler } from '@application/commands/handlers/scope-command.handler';
import type { ScopeRepository } from '@domain/repositories';
import { ScopeModel } from '@domain/models/scope';

function makeScope(
  overrides: Partial<{
    id: string;
    tenantId: string;
    name: string;
    builtIn: boolean;
  }> = {},
): ScopeModel {
  const scope = new ScopeModel({
    tenantId: overrides.tenantId ?? 'tenant-1',
    name: overrides.name ?? 'orders:read',
    displayName: 'Read orders',
    description: null,
    claimKeys: ['profile'],
    enabled: true,
    builtIn: overrides.builtIn ?? false,
  });
  scope.setPersistence(overrides.id ?? 'scope-1', new Date(), new Date());
  return scope;
}

function createScopeRepo(): jest.Mocked<ScopeRepository> {
  return {
    findById: jest.fn().mockResolvedValue(makeScope()),
    findByName: jest.fn().mockResolvedValue(null),
    findByNames: jest.fn(),
    list: jest.fn(),
    listEnabledByTenantId: jest.fn(),
    save: jest.fn().mockImplementation(async (scope: ScopeModel) => {
      if (!scope.id) scope.setPersistence('new-scope', new Date(), new Date());
      return scope;
    }),
    delete: jest.fn().mockResolvedValue(undefined),
  };
}

describe('ScopeCommandHandler', () => {
  let scopeRepo: jest.Mocked<ScopeRepository>;
  let handler: ScopeCommandHandler;

  beforeEach(() => {
    scopeRepo = createScopeRepo();
    handler = new ScopeCommandHandler(scopeRepo);
  });

  it('custom scope를 생성한다', async () => {
    const result = await handler.createScope('tenant-1', {
      name: 'orders:read',
      displayName: 'Read orders',
      claimKeys: ['profile', 'profile'],
    });

    expect(result.id).toBe('new-scope');
    const saved = scopeRepo.save.mock.calls[0][0];
    expect(saved.name).toBe('orders:read');
    expect(saved.claimKeys).toEqual(['profile']);
  });

  it('중복 scope는 생성하지 않는다', async () => {
    scopeRepo.findByName.mockResolvedValue(makeScope());

    await expect(
      handler.createScope('tenant-1', { name: 'orders:read' }),
    ).rejects.toThrow(ConflictException);
  });

  it('잘못된 scope 이름은 거부한다', async () => {
    await expect(
      handler.createScope('tenant-1', { name: '*admin' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('built-in scope는 삭제할 수 없다', async () => {
    scopeRepo.findById.mockResolvedValue(makeScope({ builtIn: true }));

    await expect(handler.deleteScope('tenant-1', 'scope-1')).rejects.toThrow(
      BadRequestException,
    );
    expect(scopeRepo.delete).not.toHaveBeenCalled();
  });

  it('tenant가 다르면 NotFoundException을 던진다', async () => {
    scopeRepo.findById.mockResolvedValue(makeScope({ tenantId: 'other' }));

    await expect(
      handler.updateScope('tenant-1', 'scope-1', { enabled: false }),
    ).rejects.toThrow(NotFoundException);
  });
});
