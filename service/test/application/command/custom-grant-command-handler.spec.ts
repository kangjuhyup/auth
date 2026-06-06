import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CustomGrantCommandHandler } from '@application/commands/handlers/custom-grant-command.handler';
import type { CustomGrantRepository } from '@domain/repositories';
import { CustomGrantModel } from '@domain/models/custom-grant';

function makeGrant(
  overrides: Partial<{
    id: string;
    tenantId: string;
    grantType: string;
    builtIn: boolean;
  }> = {},
): CustomGrantModel {
  const grant = new CustomGrantModel({
    tenantId: overrides.tenantId ?? 'tenant-1',
    grantType: overrides.grantType ?? 'urn:auth:grant-type:magic_link',
    displayName: 'Magic Link',
    description: null,
    enabled: true,
    allowedClientTypes: ['confidential'],
    allowedApplicationTypes: ['web'],
    requiresClientAuthentication: true,
    requiresGrantTypes: [],
    builtIn: overrides.builtIn ?? false,
  });
  grant.setPersistence(overrides.id ?? 'grant-1', new Date(), new Date());
  return grant;
}

function createRepo(): jest.Mocked<CustomGrantRepository> {
  return {
    findById: jest.fn().mockResolvedValue(makeGrant()),
    findByGrantType: jest.fn().mockResolvedValue(null),
    list: jest.fn(),
    listByTenantId: jest.fn(),
    listEnabledByTenantId: jest.fn(),
    save: jest.fn().mockImplementation(async (grant: CustomGrantModel) => {
      if (!grant.id) grant.setPersistence('new-grant', new Date(), new Date());
      return grant;
    }),
    delete: jest.fn().mockResolvedValue(undefined),
  };
}

describe('CustomGrantCommandHandler', () => {
  let repo: jest.Mocked<CustomGrantRepository>;
  let handler: CustomGrantCommandHandler;

  beforeEach(() => {
    repo = createRepo();
    handler = new CustomGrantCommandHandler(repo);
  });

  it('custom grant metadata를 생성한다', async () => {
    const result = await handler.createCustomGrant('tenant-1', {
      grantType: 'urn:auth:grant-type:magic_link',
      allowedClientTypes: ['confidential', 'confidential'],
    });

    expect(result.id).toBe('new-grant');
    const saved = repo.save.mock.calls[0][0];
    expect(saved.grantType).toBe('urn:auth:grant-type:magic_link');
    expect(saved.allowedClientTypes).toEqual(['confidential']);
  });

  it('중복 grant type은 생성하지 않는다', async () => {
    repo.findByGrantType.mockResolvedValue(makeGrant());

    await expect(
      handler.createCustomGrant('tenant-1', {
        grantType: 'urn:auth:grant-type:magic_link',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('urn 형식이 아닌 grant type은 거부한다', async () => {
    await expect(
      handler.createCustomGrant('tenant-1', {
        grantType: 'password',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('tenant가 다르면 NotFoundException을 던진다', async () => {
    repo.findById.mockResolvedValue(makeGrant({ tenantId: 'other' }));

    await expect(
      handler.updateCustomGrant('tenant-1', 'grant-1', { enabled: false }),
    ).rejects.toThrow(NotFoundException);
  });
});
