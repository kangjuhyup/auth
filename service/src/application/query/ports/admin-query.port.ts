import { PaginationQuery, PaginatedResult } from '@application/dto';
import { ClientResponse } from '@application/dto';
import { TenantResponse } from '@application/dto';
import { UserResponse } from '@application/dto';
import { RoleResponse } from '@application/dto';
import { PermissionResponse } from '@application/dto';
import { GroupResponse } from '@application/dto';

export const ADMIN_QUERY_PORT = Symbol('ADMIN_QUERY_PORT');

export interface AdminQueryPort {
  // Client
  getClients(tenantId: string, query: PaginationQuery): Promise<PaginatedResult<ClientResponse>>;
  getClient(tenantId: string, id: string): Promise<ClientResponse>;

  // Key
  getKeys(tenantId: string): Promise<unknown[]>;

  // Policy
  getPolicies(tenantId: string): Promise<Record<string, unknown>>;

  // Audit Log
  getAuditLogs(
    tenantId: string,
    query: PaginationQuery,
  ): Promise<PaginatedResult<Record<string, unknown>>>;

  // Tenant
  getTenants(query: PaginationQuery): Promise<PaginatedResult<TenantResponse>>;
  getTenant(id: string): Promise<TenantResponse>;

  // User
  getUsers(tenantId: string, query: PaginationQuery): Promise<PaginatedResult<UserResponse>>;
  getUser(tenantId: string, id: string): Promise<UserResponse>;

  // Role
  getRoles(tenantId: string, query: PaginationQuery): Promise<PaginatedResult<RoleResponse>>;
  getRole(tenantId: string, id: string): Promise<RoleResponse>;

  // Permission
  getPermissions(
    tenantId: string,
    query: PaginationQuery,
  ): Promise<PaginatedResult<PermissionResponse>>;
  getPermission(tenantId: string, id: string): Promise<PermissionResponse>;

  // Group
  getGroups(tenantId: string, query: PaginationQuery): Promise<PaginatedResult<GroupResponse>>;
  getGroup(tenantId: string, id: string): Promise<GroupResponse>;
}
