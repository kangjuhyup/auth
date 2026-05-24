import { ConflictException, NotFoundException } from '@nestjs/common';
import { IdentityProviderCommandHandler } from '@application/commands/handlers/identity-provider-command.handler';
import { IdentityProviderModel } from '@domain/models/identity-provider';
import type { IdentityProviderRepository } from '@domain/repositories';
import type { AuditRecorder } from '@application/services/audit-recorder';

function makeModel(
  overrides: Partial<
    ConstructorParameters<typeof IdentityProviderModel>[0]
  > = {},
) {
  return new IdentityProviderModel(
    {
      tenantId: 'tenant-1',
      provider: 'google',
      protocol: 'oauth2',
      displayName: 'Google',
      clientId: 'client-id',
      clientSecret: 'secret',
      redirectUri: 'https://app.example.com/callback',
      enabled: true,
      oauthConfig: null,
      samlConfig: null,
      ...overrides,
    },
    'idp-1',
  );
}

function makeRepository(): jest.Mocked<IdentityProviderRepository> {
  return {
    findByTenantAndProvider: jest.fn().mockResolvedValue(null),
    listEnabledByTenant: jest.fn(),
    listByTenant: jest.fn(),
    findByIdForTenant: jest.fn().mockResolvedValue(makeModel()),
    save: jest.fn().mockImplementation(async (model) => {
      if (!model.id) {
        model.setPersistence(
          'saved-idp',
          new Date('2025-01-01T00:00:00.000Z'),
          new Date('2025-01-01T00:00:00.000Z'),
        );
      }
      return model;
    }),
    delete: jest.fn().mockResolvedValue(undefined),
  };
}

function makeAuditRecorder(): jest.Mocked<AuditRecorder> {
  return {
    recordAdminAction: jest.fn().mockResolvedValue(undefined),
  } as any;
}

describe('IdentityProviderCommandHandler', () => {
  it('IdP를 생성하고 감사 로그를 기록한다', async () => {
    const repo = makeRepository();
    const audit = makeAuditRecorder();
    const handler = new IdentityProviderCommandHandler(repo, audit);

    const result = await handler.createIdentityProvider(
      'tenant-1',
      {
        provider: 'google',
        displayName: 'Google',
        clientId: 'client-id',
        clientSecret: 'secret',
        redirectUri: 'https://app.example.com/callback',
      },
      { actorUserId: 'admin-1', correlationId: 'req-1' },
    );

    expect(result).toEqual({ id: 'saved-idp' });
    expect(repo.findByTenantAndProvider).toHaveBeenCalledWith(
      'tenant-1',
      'google',
    );
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        provider: 'google',
        protocol: 'oauth2',
        enabled: true,
      }),
    );
    expect(audit.recordAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        action: 'CREATE',
        resourceType: 'identity-provider',
        resourceId: 'saved-idp',
        metadata: {
          provider: 'google',
          protocol: 'oauth2',
          enabled: true,
        },
      }),
    );
  });

  it('tenant/provider 조합이 이미 있으면 생성하지 않고 ConflictException을 던진다', async () => {
    const repo = makeRepository();
    repo.findByTenantAndProvider.mockResolvedValue(makeModel());
    const handler = new IdentityProviderCommandHandler(repo);

    await expect(
      handler.createIdentityProvider('tenant-1', {
        provider: 'google',
        displayName: 'Google',
        clientId: 'client-id',
        redirectUri: 'https://app.example.com/callback',
      }),
    ).rejects.toThrow(ConflictException);

    expect(repo.save).not.toHaveBeenCalled();
  });

  it('IdP 설정을 부분 수정하고 clientSecret 변경 여부만 감사 로그에 남긴다', async () => {
    const repo = makeRepository();
    const audit = makeAuditRecorder();
    const model = makeModel();
    repo.findByIdForTenant.mockResolvedValue(model);
    const handler = new IdentityProviderCommandHandler(repo, audit);

    await handler.updateIdentityProvider(
      'tenant-1',
      'idp-1',
      {
        displayName: 'Google Workspace',
        clientId: 'new-client',
        clientSecret: null,
        redirectUri: 'https://app.example.com/new-callback',
        enabled: false,
        oauthConfig: {
          authorizationUrl: 'https://idp.example.com/auth',
          tokenUrl: 'https://idp.example.com/token',
        },
      },
      { actorUserId: 'admin-1' },
    );

    expect(model.displayName).toBe('Google Workspace');
    expect(model.clientId).toBe('new-client');
    expect(model.clientSecret).toBeNull();
    expect(model.redirectUri).toBe('https://app.example.com/new-callback');
    expect(model.enabled).toBe(false);
    expect(model.oauthConfig).toEqual({
      authorizationUrl: 'https://idp.example.com/auth',
      tokenUrl: 'https://idp.example.com/token',
    });
    expect(repo.save).toHaveBeenCalledWith(model);
    expect(audit.recordAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'UPDATE',
        metadata: expect.objectContaining({
          changedFields: [
            'displayName',
            'clientId',
            'redirectUri',
            'enabled',
            'oauthConfig',
          ],
          clientSecretChanged: true,
        }),
      }),
    );
  });

  it('protocol 변경 시 OAuth/SAML 설정을 함께 검증한다', async () => {
    const repo = makeRepository();
    const model = makeModel();
    repo.findByIdForTenant.mockResolvedValue(model);
    const handler = new IdentityProviderCommandHandler(repo);

    await handler.updateIdentityProvider('tenant-1', 'idp-1', {
      protocol: 'saml2',
      oauthConfig: null,
      samlConfig: {
        entryPoint: 'https://okta.example.com/app/sso/saml',
        idpCerts: ['cert-1'],
      },
    });

    expect(model.protocol).toBe('saml2');
    expect(model.oauthConfig).toBeNull();
    expect(model.samlConfig).toEqual({
      entryPoint: 'https://okta.example.com/app/sso/saml',
      idpCerts: ['cert-1'],
    });
  });

  it('수정 대상이 없으면 NotFoundException을 던진다', async () => {
    const repo = makeRepository();
    repo.findByIdForTenant.mockResolvedValue(null);
    const handler = new IdentityProviderCommandHandler(repo);

    await expect(
      handler.updateIdentityProvider('tenant-1', 'missing', {
        displayName: 'Missing',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('IdP를 삭제하고 감사 로그 이후 repository 삭제를 호출한다', async () => {
    const repo = makeRepository();
    const audit = makeAuditRecorder();
    const handler = new IdentityProviderCommandHandler(repo, audit);

    await handler.deleteIdentityProvider('tenant-1', 'idp-1', {
      actorUserId: 'admin-1',
    });

    expect(audit.recordAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        action: 'DELETE',
        resourceType: 'identity-provider',
        resourceId: 'idp-1',
      }),
    );
    expect(repo.delete).toHaveBeenCalledWith('idp-1');
  });

  it('삭제 대상이 없으면 NotFoundException을 던진다', async () => {
    const repo = makeRepository();
    repo.findByIdForTenant.mockResolvedValue(null);
    const handler = new IdentityProviderCommandHandler(repo);

    await expect(
      handler.deleteIdentityProvider('tenant-1', 'missing'),
    ).rejects.toThrow(NotFoundException);

    expect(repo.delete).not.toHaveBeenCalled();
  });
});
