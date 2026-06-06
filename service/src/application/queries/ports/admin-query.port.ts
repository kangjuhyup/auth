import {
  PaginationQuery,
  PaginatedResult,
  UserListQuery,
} from '@application/dto';
import type {
  AuditLogQuery,
  AuditLogResponse,
} from '@application/dto/audit-log.dto';
import {
  ClientResponse,
  ClientAuthPolicyResponse,
  IdentityProviderResponse,
  TenantPolicyResponse,
} from '@application/dto';
import { TenantResponse } from '@application/dto';
import {
  UserResponse,
  UserConsentResponse,
  UserSessionResponse,
} from '@application/dto';
import { RoleResponse } from '@application/dto';
import { PermissionResponse } from '@application/dto';
import { ScopeResponse } from '@application/dto';
import { CustomGrantResponse } from '@application/dto';
import { GroupResponse } from '@application/dto';

export abstract class AdminQueryPort {
  // Client
  abstract getClients(
    tenantId: string,
    query: PaginationQuery,
  ): Promise<PaginatedResult<ClientResponse>>;
  abstract getClient(tenantId: string, id: string): Promise<ClientResponse>;
  abstract getClientAuthPolicy(
    tenantId: string,
    clientId: string,
  ): Promise<ClientAuthPolicyResponse>;

  // Key
  abstract getKeys(tenantId: string): Promise<unknown[]>;

  // Policy
  abstract getPolicies(tenantId: string): Promise<TenantPolicyResponse>;

  // Audit Log
  abstract getAuditLogs(
    tenantId: string,
    query: AuditLogQuery,
  ): Promise<PaginatedResult<AuditLogResponse>>;

  // Tenant
  abstract getTenants(
    query: PaginationQuery,
  ): Promise<PaginatedResult<TenantResponse>>;
  abstract getTenant(id: string): Promise<TenantResponse>;

  // User
  abstract getUsers(
    tenantId: string,
    query: UserListQuery,
  ): Promise<PaginatedResult<UserResponse>>;
  abstract getUser(tenantId: string, id: string): Promise<UserResponse>;
  abstract getUserConsents(
    tenantId: string,
    userId: string,
    query: PaginationQuery,
  ): Promise<PaginatedResult<UserConsentResponse>>;
  abstract getUserConsentHistory(
    tenantId: string,
    userId: string,
    query: PaginationQuery,
  ): Promise<PaginatedResult<UserConsentResponse>>;
  abstract getUserSessions(
    tenantId: string,
    userId: string,
  ): Promise<UserSessionResponse[]>;

  // Role
  abstract getRoles(
    tenantId: string,
    query: PaginationQuery,
  ): Promise<PaginatedResult<RoleResponse>>;
  abstract getRole(tenantId: string, id: string): Promise<RoleResponse>;
  abstract getRolePermissions(
    tenantId: string,
    roleId: string,
    query: PaginationQuery,
  ): Promise<PaginatedResult<PermissionResponse>>;

  // Permission
  abstract getPermissions(
    tenantId: string,
    query: PaginationQuery,
  ): Promise<PaginatedResult<PermissionResponse>>;
  abstract getPermission(
    tenantId: string,
    id: string,
  ): Promise<PermissionResponse>;

  // Scope
  abstract getScopes(
    tenantId: string,
    query: PaginationQuery,
  ): Promise<PaginatedResult<ScopeResponse>>;
  abstract getScope(tenantId: string, id: string): Promise<ScopeResponse>;

  // Custom Grant
  abstract getCustomGrants(
    tenantId: string,
    query: PaginationQuery,
  ): Promise<PaginatedResult<CustomGrantResponse>>;
  abstract getCustomGrant(
    tenantId: string,
    id: string,
  ): Promise<CustomGrantResponse>;

  // Group
  abstract getGroups(
    tenantId: string,
    query: PaginationQuery,
  ): Promise<PaginatedResult<GroupResponse>>;
  abstract getGroup(tenantId: string, id: string): Promise<GroupResponse>;
  abstract getGroupRoles(
    tenantId: string,
    groupId: string,
  ): Promise<RoleResponse[]>;

  // User roles
  abstract getUserRoles(
    tenantId: string,
    userId: string,
  ): Promise<RoleResponse[]>;

  // Identity providers (social / OIDC IdP)
  abstract getIdentityProviders(
    tenantId: string,
    query: PaginationQuery,
  ): Promise<PaginatedResult<IdentityProviderResponse>>;
  abstract getIdentityProvider(
    tenantId: string,
    id: string,
  ): Promise<IdentityProviderResponse>;
}
