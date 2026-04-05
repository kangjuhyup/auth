import { PaginationQuery, PaginatedResult } from '@application/dto';
import {
  ClientResponse,
  ClientAuthPolicyResponse,
  IdentityProviderResponse,
} from '@application/dto';
import { TenantResponse } from '@application/dto';
import { UserResponse } from '@application/dto';
import { RoleResponse } from '@application/dto';
import { PermissionResponse } from '@application/dto';
import { GroupResponse } from '@application/dto';

export abstract class AdminQueryPort {
  // Client
  abstract getClients(tenantId: string, query: PaginationQuery): Promise<PaginatedResult<ClientResponse>>;
  abstract getClient(tenantId: string, id: string): Promise<ClientResponse>;
  abstract getClientAuthPolicy(tenantId: string, clientId: string): Promise<ClientAuthPolicyResponse>;

  // Key
  abstract getKeys(tenantId: string): Promise<unknown[]>;

  // Policy
  abstract getPolicies(tenantId: string): Promise<Record<string, unknown>>;

  // Audit Log
  abstract getAuditLogs(
    tenantId: string,
    query: PaginationQuery,
  ): Promise<PaginatedResult<Record<string, unknown>>>;

  // Tenant
  abstract getTenants(query: PaginationQuery): Promise<PaginatedResult<TenantResponse>>;
  abstract getTenant(id: string): Promise<TenantResponse>;

  // User
  abstract getUsers(tenantId: string, query: PaginationQuery): Promise<PaginatedResult<UserResponse>>;
  abstract getUser(tenantId: string, id: string): Promise<UserResponse>;

  // Role
  abstract getRoles(tenantId: string, query: PaginationQuery): Promise<PaginatedResult<RoleResponse>>;
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
  abstract getPermission(tenantId: string, id: string): Promise<PermissionResponse>;

  // Group
  abstract getGroups(tenantId: string, query: PaginationQuery): Promise<PaginatedResult<GroupResponse>>;
  abstract getGroup(tenantId: string, id: string): Promise<GroupResponse>;
  abstract getGroupRoles(tenantId: string, groupId: string): Promise<RoleResponse[]>;

  // User roles
  abstract getUserRoles(tenantId: string, userId: string): Promise<RoleResponse[]>;

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
