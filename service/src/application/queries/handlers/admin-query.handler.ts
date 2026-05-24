import { Injectable, NotFoundException } from '@nestjs/common';
import { Logging, NoLog } from '@kangjuhyup/rvlog';
import { orThrow } from '@domain/utils';
import { AdminQueryPort } from '../ports/admin-query.port';
import {
  PaginationQuery,
  PaginatedResult,
  TenantResponse,
  ClientResponse,
  ClientAuthPolicyResponse,
  UserResponse,
  UserConsentResponse,
  RoleResponse,
  PermissionResponse,
  GroupResponse,
  IdentityProviderResponse,
  TenantPolicyResponse,
} from '@application/dto';
import type {
  AuditLogQuery,
  AuditLogResponse,
} from '@application/dto/audit-log.dto';
import {
  TenantRepository,
  GroupRepository,
  RoleRepository,
  PermissionRepository,
  RolePermissionRepository,
  RoleAssignmentRepository,
  ClientRepository,
  TenantConfigRepository,
  JwksKeyRepository,
  ClientAuthPolicyRepository,
  EventRepository,
  IdentityProviderRepository,
  ConsentRepository,
} from '@domain/repositories';
import { UserWriteRepositoryPort } from '@application/commands/ports/user-write-repository.port';
import { IdentityProviderModel } from '@domain/models/identity-provider';
import { ConsentModel } from '@domain/models/consent';
import { TenantConfigModel } from '@domain/models/tenant-config';

@Injectable()
@Logging()
export class AdminQueryHandler implements AdminQueryPort {
  constructor(
    private readonly tenantRepo: TenantRepository,
    private readonly groupRepo: GroupRepository,
    private readonly roleRepo: RoleRepository,
    private readonly permissionRepo: PermissionRepository,
    private readonly rolePermissionRepo: RolePermissionRepository,
    private readonly roleAssignmentRepo: RoleAssignmentRepository,
    private readonly clientRepo: ClientRepository,
    private readonly tenantConfigRepo: TenantConfigRepository,
    private readonly jwksKeyRepo: JwksKeyRepository,
    private readonly clientAuthPolicyRepo: ClientAuthPolicyRepository,
    private readonly eventRepo: EventRepository,
    private readonly userRepo: UserWriteRepositoryPort,
    private readonly identityProviderRepo: IdentityProviderRepository,
    private readonly consentRepo: ConsentRepository,
  ) {}

  // ── Tenant ──────────────────────────────────────────────────────────────

  async getTenants(
    query: PaginationQuery,
  ): Promise<PaginatedResult<TenantResponse>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const { items, total } = await this.tenantRepo.list({ page, limit });

    const responses: TenantResponse[] = [];
    for (const t of items) {
      const config = await this.tenantConfigRepo.findByTenantId(t.id);
      responses.push({
        id: t.id,
        code: t.code,
        name: t.name,
        signupPolicy: config?.signupPolicy ?? 'open',
        requirePhoneVerify: config?.requirePhoneVerify ?? false,
        brandName: config?.brandName ?? null,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      });
    }

    return { items: responses, total, page, limit };
  }

  async getTenant(id: string): Promise<TenantResponse> {
    const tenant = orThrow(
      await this.tenantRepo.findById(id),
      new NotFoundException('Tenant not found'),
    );

    const config = await this.tenantConfigRepo.findByTenantId(tenant.id);

    return {
      id: tenant.id,
      code: tenant.code,
      name: tenant.name,
      signupPolicy: config?.signupPolicy ?? 'open',
      requirePhoneVerify: config?.requirePhoneVerify ?? false,
      brandName: config?.brandName ?? null,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    };
  }

  // ── Not implemented ──────────────────────────────────────────────────────

  async getClients(
    tenantId: string,
    query: PaginationQuery,
  ): Promise<PaginatedResult<ClientResponse>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const { items, total } = await this.clientRepo.list({
      tenantId,
      page,
      limit,
    });

    return {
      items: items.map((c) => ({
        id: c.id,
        clientId: c.clientId,
        name: c.name,
        type: c.type,
        enabled: c.enabled,
        redirectUris: c.redirectUris,
        grantTypes: c.grantTypes,
        responseTypes: c.responseTypes,
        tokenEndpointAuthMethod: c.tokenEndpointAuthMethod,
        scope: c.scope,
        postLogoutRedirectUris: c.postLogoutRedirectUris,
        applicationType: c.applicationType,
        backchannelLogoutUri: c.backchannelLogoutUri ?? null,
        frontchannelLogoutUri: c.frontchannelLogoutUri ?? null,
        allowedResources: c.allowedResources,
        skipConsent: c.skipConsent,
        accessTokenTtlSec: c.accessTokenTtlSec ?? null,
        refreshTokenTtlSec: c.refreshTokenTtlSec ?? null,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
      total,
      page,
      limit,
    };
  }

  async getClient(tenantId: string, id: string): Promise<ClientResponse> {
    const client = orThrow(
      await this.clientRepo.findById(id),
      new NotFoundException('Client not found'),
      (c) => c.tenantId === tenantId,
    );

    return {
      id: client.id,
      clientId: client.clientId,
      name: client.name,
      type: client.type,
      enabled: client.enabled,
      redirectUris: client.redirectUris,
      grantTypes: client.grantTypes,
      responseTypes: client.responseTypes,
      tokenEndpointAuthMethod: client.tokenEndpointAuthMethod,
      scope: client.scope,
      postLogoutRedirectUris: client.postLogoutRedirectUris,
      applicationType: client.applicationType,
      backchannelLogoutUri: client.backchannelLogoutUri ?? null,
      frontchannelLogoutUri: client.frontchannelLogoutUri ?? null,
      allowedResources: client.allowedResources,
      skipConsent: client.skipConsent,
      accessTokenTtlSec: client.accessTokenTtlSec ?? null,
      refreshTokenTtlSec: client.refreshTokenTtlSec ?? null,
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
    };
  }

  async getClientAuthPolicy(
    tenantId: string,
    clientId: string,
  ): Promise<ClientAuthPolicyResponse> {
    const client = orThrow(
      await this.clientRepo.findById(clientId),
      new NotFoundException('Client not found'),
      (c) => c.tenantId === tenantId,
    );

    const policy = orThrow(
      await this.clientAuthPolicyRepo.findByClientRefId(clientId),
      new NotFoundException('Client auth policy not found'),
    );
    const tenantConfig =
      (await this.tenantConfigRepo.findByTenantId(tenantId)) ??
      this.createDefaultTenantConfig(tenantId);

    return {
      clientRefId: policy.clientRefId,
      allowedAuthMethods: policy.allowedAuthMethods,
      defaultAcr: policy.defaultAcr,
      mfaRequired: policy.mfaRequired,
      allowedMfaMethods: policy.allowedMfaMethods,
      maxSessionDurationSec: policy.maxSessionDurationSec,
      consentRequired: policy.consentRequired,
      requireAuthTime: policy.requireAuthTime,
      allowedIdpProviderKeys: policy.allowedIdpProviderKeys,
      reauthenticationIntervalSec: policy.reauthenticationIntervalSec,
      refreshTokenRotationEnabled: policy.refreshTokenRotationEnabled,
      refreshTokenReuseAction: policy.refreshTokenReuseAction,
      effective: policy.resolveEffectivePolicy(
        tenantConfig.getPolicies(),
        client.refreshTokenTtlSec,
      ),
    };
  }

  async getKeys(tenantId: string): Promise<unknown[]> {
    const keys = await this.jwksKeyRepo.findActiveByTenantId(tenantId);
    return keys.map((k) => ({
      kid: k.kid,
      algorithm: k.algorithm,
      publicKey: k.publicKey,
      status: k.status,
      rotatedAt: k.rotatedAt ?? null,
      expiresAt: k.expiresAt ?? null,
      createdAt: k.createdAt,
    }));
  }

  async getPolicies(tenantId: string): Promise<TenantPolicyResponse> {
    const config =
      (await this.tenantConfigRepo.findByTenantId(tenantId)) ??
      this.createDefaultTenantConfig(tenantId);
    return config.getPolicies();
  }

  @NoLog
  private createDefaultTenantConfig(tenantId: string): TenantConfigModel {
    return new TenantConfigModel({
      tenantId,
      signupPolicy: 'open',
      requirePhoneVerify: false,
      brandName: null,
      accessTokenTtlSec: 60 * 60,
      refreshTokenTtlSec: 14 * 24 * 60 * 60,
      extra: null,
    });
  }

  async getAuditLogs(
    tenantId: string,
    query: AuditLogQuery,
  ): Promise<PaginatedResult<AuditLogResponse>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const { items, total } = await this.eventRepo.list({
      tenantId,
      page,
      limit,
      ...(query.from ? { from: new Date(query.from) } : {}),
      ...(query.to ? { to: new Date(query.to) } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.severity ? { severity: query.severity } : {}),
      ...(query.correlationId ? { correlationId: query.correlationId } : {}),
    });

    return {
      items: items.map((e) => ({
        id: e.id,
        category: e.category,
        severity: e.severity,
        action: e.action,
        userId: e.userId ?? null,
        clientId: e.clientId ?? null,
        resourceType: e.resourceType ?? null,
        resourceId: e.resourceId ?? null,
        success: e.success,
        reason: e.reason ?? null,
        userAgent: e.userAgent ?? null,
        correlationId: e.correlationId ?? null,
        metadata: e.metadata ?? null,
        occurredAt: e.occurredAt,
      })),
      total,
      page,
      limit,
    };
  }

  async getUsers(
    tenantId: string,
    query: PaginationQuery,
  ): Promise<PaginatedResult<UserResponse>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const { items, total } = await this.userRepo.list({
      tenantId,
      page,
      limit,
    });

    return {
      items: items.map((u) => ({
        id: u.id,
        username: u.username,
        email: u.email ?? null,
        emailVerified: u.emailVerified,
        phone: u.phone ?? null,
        phoneVerified: u.phoneVerified,
        status: u.status,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      })),
      total,
      page,
      limit,
    };
  }

  async getUser(tenantId: string, id: string): Promise<UserResponse> {
    const user = orThrow(
      await this.userRepo.findById(id),
      new NotFoundException('User not found'),
      (u) => u.tenantId === tenantId,
    );

    return {
      id: user.id,
      username: user.username,
      email: user.email ?? null,
      emailVerified: user.emailVerified,
      phone: user.phone ?? null,
      phoneVerified: user.phoneVerified,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async getUserConsents(
    tenantId: string,
    userId: string,
    query: PaginationQuery,
  ): Promise<PaginatedResult<UserConsentResponse>> {
    await this.assertUserInTenant(tenantId, userId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { items, total } = await this.consentRepo.listByUser({
      tenantId,
      userId,
      page,
      limit,
    });

    return {
      items: items.map((consent) => this.toUserConsentResponse(consent)),
      total,
      page,
      limit,
    };
  }

  async getUserConsentHistory(
    tenantId: string,
    userId: string,
    query: PaginationQuery,
  ): Promise<PaginatedResult<UserConsentResponse>> {
    await this.assertUserInTenant(tenantId, userId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { items, total } = await this.consentRepo.listByUser({
      tenantId,
      userId,
      page,
      limit,
      includeRevoked: true,
    });

    return {
      items: items.map((consent) => this.toUserConsentResponse(consent)),
      total,
      page,
      limit,
    };
  }

  @NoLog
  private async assertUserInTenant(
    tenantId: string,
    userId: string,
  ): Promise<void> {
    orThrow(
      await this.userRepo.findById(userId),
      new NotFoundException('User not found'),
      (u) => u.tenantId === tenantId,
    );
  }

  @NoLog
  private toUserConsentResponse(consent: ConsentModel): UserConsentResponse {
    return {
      id: consent.id ?? '',
      userId: consent.userId,
      clientRefId: consent.clientRefId,
      clientId: consent.clientId ?? consent.clientRefId,
      clientName: consent.clientName ?? consent.clientId ?? consent.clientRefId,
      grantedScopes: consent.grantedScopes,
      grantedAt: consent.grantedAt,
      revokedAt: consent.revokedAt ?? null,
      status: consent.isRevoked ? 'REVOKED' : 'ACTIVE',
    };
  }

  async getRoles(
    tenantId: string,
    query: PaginationQuery,
  ): Promise<PaginatedResult<RoleResponse>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const { items, total } = await this.roleRepo.list({
      tenantId,
      page,
      limit,
    });

    return {
      items: items.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        description: r.description ?? null,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
      total,
      page,
      limit,
    };
  }

  async getRole(tenantId: string, id: string): Promise<RoleResponse> {
    const role = orThrow(
      await this.roleRepo.findById(id),
      new NotFoundException('Role not found'),
      (r) => r.tenantId === tenantId,
    );

    return {
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description ?? null,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }

  async getRolePermissions(
    tenantId: string,
    roleId: string,
    query: PaginationQuery,
  ): Promise<PaginatedResult<PermissionResponse>> {
    orThrow(
      await this.roleRepo.findById(roleId),
      new NotFoundException('Role not found'),
      (r) => r.tenantId === tenantId,
    );

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const { items, total } = await this.rolePermissionRepo.listByRole({
      roleId,
      page,
      limit,
    });

    return {
      items: items.map((p) => ({
        id: p.id,
        code: p.code,
        resource: p.resource ?? null,
        action: p.action ?? null,
        description: p.description ?? null,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
      total,
      page,
      limit,
    };
  }

  async getPermissions(
    tenantId: string,
    query: PaginationQuery,
  ): Promise<PaginatedResult<PermissionResponse>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const { items, total } = await this.permissionRepo.list({
      tenantId,
      page,
      limit,
    });

    return {
      items: items.map((p) => ({
        id: p.id,
        code: p.code,
        resource: p.resource ?? null,
        action: p.action ?? null,
        description: p.description ?? null,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
      total,
      page,
      limit,
    };
  }

  async getPermission(
    tenantId: string,
    id: string,
  ): Promise<PermissionResponse> {
    const permission = orThrow(
      await this.permissionRepo.findById(id),
      new NotFoundException('Permission not found'),
      (p) => p.tenantId === tenantId,
    );

    return {
      id: permission.id,
      code: permission.code,
      resource: permission.resource ?? null,
      action: permission.action ?? null,
      description: permission.description ?? null,
      createdAt: permission.createdAt,
      updatedAt: permission.updatedAt,
    };
  }

  async getGroups(
    tenantId: string,
    query: PaginationQuery,
  ): Promise<PaginatedResult<GroupResponse>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const { items, total } = await this.groupRepo.list({
      tenantId,
      page,
      limit,
    });

    return {
      items: items.map((g) => ({
        id: g.id,
        code: g.code,
        name: g.name,
        parentId: g.parentId ?? null,
        createdAt: g.createdAt,
        updatedAt: g.updatedAt,
      })),
      total,
      page,
      limit,
    };
  }

  async getGroup(tenantId: string, id: string): Promise<GroupResponse> {
    const group = orThrow(
      await this.groupRepo.findById(id),
      new NotFoundException('Group not found'),
      (g) => g.tenantId === tenantId,
    );

    return {
      id: group.id,
      code: group.code,
      name: group.name,
      parentId: group.parentId ?? null,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
    };
  }

  async getGroupRoles(
    tenantId: string,
    groupId: string,
  ): Promise<RoleResponse[]> {
    orThrow(
      await this.groupRepo.findById(groupId),
      new NotFoundException('Group not found'),
      (g) => g.tenantId === tenantId,
    );

    const roles = await this.roleAssignmentRepo.listForGroup(groupId);
    return roles.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description ?? null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async getUserRoles(
    tenantId: string,
    userId: string,
  ): Promise<RoleResponse[]> {
    const roles = await this.roleAssignmentRepo.listForUser(userId);
    return roles.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description ?? null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  @NoLog
  private toIdentityProviderResponse(
    m: IdentityProviderModel,
  ): IdentityProviderResponse {
    return {
      id: m.id,
      provider: m.provider,
      protocol: m.protocol,
      displayName: m.displayName,
      clientId: m.clientId,
      clientSecretSet: m.clientSecret != null && m.clientSecret.length > 0,
      redirectUri: m.redirectUri,
      enabled: m.enabled,
      oauthConfig: m.oauthConfig,
      samlConfig: m.samlConfig,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    };
  }

  async getIdentityProviders(
    tenantId: string,
    query: PaginationQuery,
  ): Promise<PaginatedResult<IdentityProviderResponse>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const { items, total } = await this.identityProviderRepo.listByTenant({
      tenantId,
      page,
      limit,
    });

    return {
      items: items.map((m) => this.toIdentityProviderResponse(m)),
      total,
      page,
      limit,
    };
  }

  async getIdentityProvider(
    tenantId: string,
    id: string,
  ): Promise<IdentityProviderResponse> {
    const model = orThrow(
      await this.identityProviderRepo.findByIdForTenant(tenantId, id),
      new NotFoundException('Identity provider not found'),
    );
    return this.toIdentityProviderResponse(model);
  }
}
