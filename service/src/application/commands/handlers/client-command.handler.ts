import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ClientCommandPort } from '../ports/client-command.port';
import {
  CreateClientDto,
  AuditContext,
  UpdateClientAuthPolicyDto,
  UpdateClientDto,
} from '@application/dto';
import {
  ClientAuthPolicyRepository,
  ClientRepository,
} from '@domain/repositories';
import { ClientModel } from '@domain/models/client';
import { ClientAuthPolicyModel } from '@domain/models/client-auth-policy';
import type { AuthMethod, MfaMethod } from '@domain/models/client-auth-policy';
import { SymmetricCryptoPort } from '@application/ports/symmetric-crypto.port';
import { orThrow } from '@domain/utils';
import { AuditRecorder } from '@application/services/audit-recorder';
import { GrantTypeRegistryPort } from '@application/ports/grant-type-registry.port';
import type { GrantTypeValidationIssue } from '@application/ports/grant-type-registry.port';
import { ScopeRegistryPort } from '@application/ports/scope-registry.port';
import type { ScopeValidationIssue } from '@application/ports/scope-registry.port';
import { normalizeScopeString, parseScopeString } from '@domain/models/scope';
import { ResourceOrigin } from '@domain/value-objects/resource-origin';

@Injectable()
export class ClientCommandHandler implements ClientCommandPort {
  private readonly logger = new Logger(ClientCommandHandler.name);

  constructor(
    private readonly clientRepo: ClientRepository,
    private readonly clientAuthPolicyRepo: ClientAuthPolicyRepository,
    private readonly symmetricCrypto: SymmetricCryptoPort,
    private readonly grantTypeRegistry: GrantTypeRegistryPort,
    private readonly scopeRegistry: ScopeRegistryPort,
    private readonly auditRecorder?: AuditRecorder,
  ) {}

  async createClient(
    tenantId: string,
    dto: CreateClientDto,
    auditContext?: AuditContext,
  ): Promise<{ id: string }> {
    this.logger.log(
      `Creating client clientId=${dto.clientId} in tenant=${tenantId}`,
    );

    const existing = await this.clientRepo.findByClientId(
      tenantId,
      dto.clientId,
    );
    if (existing) throw new ConflictException('Client ID already exists');

    const clientType = dto.type ?? 'public';
    const applicationType = dto.applicationType ?? 'web';
    const grantTypes = dto.grantTypes ?? ['authorization_code'];
    const tokenEndpointAuthMethod = dto.tokenEndpointAuthMethod ?? 'none';
    const normalizedIntrospectionResources =
      this.normalizeAndAssertIntrospectionResources({
        clientType,
        tokenEndpointAuthMethod,
        hasSecret: Boolean(dto.secret),
        resources: dto.introspectionResources ?? [],
      });

    await this.assertGrantTypesAllowed({
      tenantId,
      clientType,
      applicationType,
      tokenEndpointAuthMethod,
      grantTypes,
    });
    const scope = await this.normalizeAndAssertScopesAllowed(
      tenantId,
      dto.scope ?? 'openid',
    );

    const secretEnc = dto.secret
      ? this.symmetricCrypto.encrypt(dto.secret)
      : null;

    const client = new ClientModel({
      tenantId,
      clientId: dto.clientId,
      secretEnc,
      name: dto.name,
      type: clientType,
      enabled: true,
      redirectUris: dto.redirectUris ?? [],
      grantTypes,
      responseTypes: dto.responseTypes ?? ['code'],
      tokenEndpointAuthMethod,
      scope,
      postLogoutRedirectUris: dto.postLogoutRedirectUris ?? [],
      applicationType,
      backchannelLogoutUri: dto.backchannelLogoutUri ?? null,
      frontchannelLogoutUri: dto.frontchannelLogoutUri ?? null,
      allowedResources: dto.allowedResources ?? [],
      introspectionResources: [],
      skipConsent: dto.skipConsent ?? false,
      accessTokenTtlSec: dto.accessTokenTtlSec ?? null,
      refreshTokenTtlSec: dto.refreshTokenTtlSec ?? null,
    });
    client.changeIntrospectionResources(normalizedIntrospectionResources);

    const saved = await this.clientRepo.save(client);
    await this.clientAuthPolicyRepo.save(
      this.createDefaultAuthPolicy(tenantId, saved.id),
    );
    await this.auditRecorder?.recordAdminAction({
      tenantId,
      action: 'CREATE',
      resourceType: 'client',
      resourceId: saved.id,
      metadata: {
        clientId: saved.clientId,
        type: saved.type,
        tokenEndpointAuthMethod: saved.tokenEndpointAuthMethod,
      },
      auditContext,
    });
    return { id: saved.id };
  }

  async updateClient(
    tenantId: string,
    id: string,
    dto: UpdateClientDto,
    auditContext?: AuditContext,
  ): Promise<void> {
    this.logger.log(`Updating client id=${id} in tenant=${tenantId}`);

    const client = orThrow(
      await this.clientRepo.findById(id),
      new NotFoundException('Client not found'),
      (c) => c.tenantId === tenantId,
    );

    const nextResources =
      dto.introspectionResources ?? client.introspectionResources;
    const nextAuthMethod =
      dto.tokenEndpointAuthMethod ?? client.tokenEndpointAuthMethod;
    const nextHasSecret =
      dto.secret === undefined ? Boolean(client.secretEnc) : Boolean(dto.secret);
    const normalizedIntrospectionResources =
      this.normalizeAndAssertIntrospectionResources({
        clientType: client.type,
        tokenEndpointAuthMethod: nextAuthMethod,
        hasSecret: nextHasSecret,
        resources: nextResources,
      });

    if (
      dto.grantTypes !== undefined ||
      dto.applicationType !== undefined ||
      dto.tokenEndpointAuthMethod !== undefined
    ) {
      await this.assertGrantTypesAllowed({
        tenantId,
        clientType: client.type,
        applicationType: dto.applicationType ?? client.applicationType,
        tokenEndpointAuthMethod:
          dto.tokenEndpointAuthMethod ?? client.tokenEndpointAuthMethod,
        grantTypes: dto.grantTypes ?? client.grantTypes,
      });
    }

    if (dto.secret !== undefined) {
      client.changeSecretEnc(
        dto.secret ? this.symmetricCrypto.encrypt(dto.secret) : null,
      );
    }
    if (dto.name !== undefined) client.changeName(dto.name);
    if (dto.enabled !== undefined) client.setEnabled(dto.enabled);
    if (dto.redirectUris !== undefined)
      client.changeRedirectUris(dto.redirectUris);
    if (dto.grantTypes !== undefined) client.changeGrantTypes(dto.grantTypes);
    if (dto.responseTypes !== undefined)
      client.changeResponseTypes(dto.responseTypes);
    if (dto.tokenEndpointAuthMethod !== undefined)
      client.changeTokenEndpointAuthMethod(dto.tokenEndpointAuthMethod);
    if (dto.scope !== undefined) {
      client.changeScope(
        await this.normalizeAndAssertScopesAllowed(tenantId, dto.scope),
      );
    }
    if (dto.postLogoutRedirectUris !== undefined)
      client.changePostLogoutRedirectUris(dto.postLogoutRedirectUris);
    if (dto.applicationType !== undefined)
      client.changeApplicationType(dto.applicationType);
    if (dto.backchannelLogoutUri !== undefined)
      client.changeBackchannelLogoutUri(dto.backchannelLogoutUri ?? null);
    if (dto.frontchannelLogoutUri !== undefined)
      client.changeFrontchannelLogoutUri(dto.frontchannelLogoutUri ?? null);
    if (dto.allowedResources !== undefined)
      client.changeAllowedResources(dto.allowedResources);
    client.changeIntrospectionResources(normalizedIntrospectionResources);
    if (dto.skipConsent !== undefined) client.setSkipConsent(dto.skipConsent);
    if (dto.accessTokenTtlSec !== undefined)
      client.changeAccessTokenTtlSec(dto.accessTokenTtlSec);
    if (dto.refreshTokenTtlSec !== undefined)
      client.changeRefreshTokenTtlSec(dto.refreshTokenTtlSec);

    await this.clientRepo.save(client);
    await this.auditRecorder?.recordAdminAction({
      tenantId,
      action: 'UPDATE',
      resourceType: 'client',
      resourceId: id,
      metadata: {
        changedFields: Object.keys(dto).filter((key) => key !== 'secret'),
        secretChanged: dto.secret !== undefined,
      },
      auditContext,
    });
  }

  async updateClientAuthPolicy(
    tenantId: string,
    id: string,
    dto: UpdateClientAuthPolicyDto,
    auditContext?: AuditContext,
  ): Promise<void> {
    this.logger.log(
      `Updating client auth policy id=${id} in tenant=${tenantId}`,
    );

    const client = orThrow(
      await this.clientRepo.findById(id),
      new NotFoundException('Client not found'),
      (c) => c.tenantId === tenantId,
    );

    const policy =
      (await this.clientAuthPolicyRepo.findByClientRefId(id)) ??
      this.createDefaultAuthPolicy(tenantId, client.id);

    if (dto.allowedAuthMethods !== undefined) {
      policy.changeAllowedAuthMethods(dto.allowedAuthMethods as AuthMethod[]);
    }
    if (dto.defaultAcr !== undefined) policy.changeDefaultAcr(dto.defaultAcr);
    if (dto.mfaRequired !== undefined)
      policy.changeMfaRequired(dto.mfaRequired);
    if (dto.allowedMfaMethods !== undefined) {
      policy.changeAllowedMfaMethods(dto.allowedMfaMethods as MfaMethod[]);
    }
    if (dto.maxSessionDurationSec !== undefined) {
      policy.changeMaxSessionDurationSec(dto.maxSessionDurationSec);
    }
    if (dto.consentRequired !== undefined) {
      policy.changeConsentRequired(dto.consentRequired);
    }
    if (dto.requireAuthTime !== undefined) {
      policy.changeRequireAuthTime(dto.requireAuthTime);
    }
    if (dto.allowedIdpProviderKeys !== undefined) {
      policy.changeAllowedIdpProviderKeys(dto.allowedIdpProviderKeys);
    }
    if (dto.reauthenticationIntervalSec !== undefined) {
      policy.changeReauthenticationIntervalSec(dto.reauthenticationIntervalSec);
    }
    if (dto.refreshTokenRotationEnabled !== undefined) {
      policy.changeRefreshTokenRotationEnabled(dto.refreshTokenRotationEnabled);
    }
    if (dto.refreshTokenReuseAction !== undefined) {
      policy.changeRefreshTokenReuseAction(dto.refreshTokenReuseAction);
    }
    if (dto.loginSessionMode !== undefined) {
      policy.changeLoginSessionMode(dto.loginSessionMode);
    }
    if (dto.maxConcurrentSessions !== undefined) {
      policy.changeMaxConcurrentSessions(dto.maxConcurrentSessions);
    }
    if (dto.sessionConflictAction !== undefined) {
      policy.changeSessionConflictAction(dto.sessionConflictAction);
    }

    await this.clientAuthPolicyRepo.save(policy);
    await this.auditRecorder?.recordAdminAction({
      tenantId,
      action: 'CONFIG_CHANGE',
      resourceType: 'client-auth-policy',
      resourceId: id,
      metadata: {
        changedFields: Object.keys(dto),
      },
      auditContext,
    });
  }

  async deleteClient(
    tenantId: string,
    id: string,
    auditContext?: AuditContext,
  ): Promise<void> {
    this.logger.log(`Deleting client id=${id} in tenant=${tenantId}`);

    orThrow(
      await this.clientRepo.findById(id),
      new NotFoundException('Client not found'),
      (c) => c.tenantId === tenantId,
    );

    await this.auditRecorder?.recordAdminAction({
      tenantId,
      action: 'DELETE',
      resourceType: 'client',
      resourceId: id,
      auditContext,
    });
    await this.clientRepo.delete(id);
  }

  private createDefaultAuthPolicy(
    tenantId: string,
    clientRefId: string,
  ): ClientAuthPolicyModel {
    return new ClientAuthPolicyModel({
      tenantId,
      clientRefId,
      allowedAuthMethods: ['password'],
      defaultAcr: 'urn:auth:pwd',
      mfaRequired: false,
      allowedMfaMethods: ['totp'],
      maxSessionDurationSec: null,
      consentRequired: true,
      requireAuthTime: false,
      allowedIdpProviderKeys: null,
      reauthenticationIntervalSec: null,
      refreshTokenRotationEnabled: true,
      refreshTokenReuseAction: 'revoke_grant',
      loginSessionMode: null,
      maxConcurrentSessions: null,
      sessionConflictAction: null,
    });
  }

  private async assertGrantTypesAllowed(params: {
    tenantId: string;
    clientType: ClientModel['type'];
    applicationType: ClientModel['applicationType'];
    tokenEndpointAuthMethod: string;
    grantTypes: string[];
  }): Promise<void> {
    const issues =
      await this.grantTypeRegistry.validateClientGrantTypes(params);
    if (issues.length === 0) return;

    throw new BadRequestException({
      message: 'Invalid client grant type policy',
      issues: issues.map(formatGrantTypeIssue),
    });
  }

  private async normalizeAndAssertScopesAllowed(
    tenantId: string,
    scope: string,
  ): Promise<string> {
    const scopes = parseScopeString(scope);
    const issues = await this.scopeRegistry.validateClientScopes({
      tenantId,
      scopes,
    });
    if (issues.length > 0) {
      throw new BadRequestException({
        message: 'Invalid client scope policy',
        issues: issues.map(formatScopeIssue),
      });
    }

    return normalizeScopeString(scope);
  }

  private normalizeAndAssertIntrospectionResources(params: {
    clientType: ClientModel['type'];
    tokenEndpointAuthMethod: string;
    hasSecret: boolean;
    resources: string[];
  }): string[] {
    if (params.resources.length === 0) return [];
    if (params.clientType !== 'service') {
      throw new BadRequestException({
        message: 'Invalid resource server introspection policy',
        issues: ['client_type_not_allowed'],
      });
    }
    if (params.tokenEndpointAuthMethod !== 'client_secret_basic') {
      throw new BadRequestException({
        message: 'Invalid resource server introspection policy',
        issues: ['client_auth_method_not_allowed'],
      });
    }
    if (!params.hasSecret) {
      throw new BadRequestException({
        message: 'Invalid resource server introspection policy',
        issues: ['client_secret_required'],
      });
    }

    try {
      return [
        ...new Set(
          params.resources.map(
            (resource) => ResourceOrigin.of(resource).value,
          ),
        ),
      ];
    } catch {
      throw new BadRequestException({
        message: 'Invalid resource server introspection policy',
        issues: ['invalid_resource_origin'],
      });
    }
  }
}

function formatGrantTypeIssue(issue: GrantTypeValidationIssue): string {
  if (issue.reason === 'required_grant_missing') {
    return `${issue.grantType}: ${issue.reason}:${issue.requiredGrantType}`;
  }
  return `${issue.grantType}: ${issue.reason}`;
}

function formatScopeIssue(issue: ScopeValidationIssue): string {
  return `${issue.scope || '<empty>'}: ${issue.reason}`;
}
