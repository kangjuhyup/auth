import { CreateClientDto, UpdateClientDto } from '@application/dto';
import { CreateTenantDto, UpdateTenantDto } from '@application/dto';
import { CreateUserDto, UpdateUserDto } from '@application/dto';
import { CreateRoleDto, UpdateRoleDto } from '@application/dto';
import { CreatePermissionDto, UpdatePermissionDto } from '@application/dto';
import { CreateGroupDto, UpdateGroupDto } from '@application/dto';

export const ADMIN_COMMAND_PORT = Symbol('ADMIN_COMMAND_PORT');

export interface AdminCommandPort {
  // Client
  createClient(tenantId: string, dto: CreateClientDto): Promise<{ id: string }>;
  updateClient(
    tenantId: string,
    id: string,
    dto: UpdateClientDto,
  ): Promise<void>;
  deleteClient(tenantId: string, id: string): Promise<void>;

  // Key
  rotateKeys(tenantId: string): Promise<void>;

  // Policy
  updatePolicies(
    tenantId: string,
    policies: Record<string, unknown>,
  ): Promise<void>;

  // Tenant
  createTenant(dto: CreateTenantDto): Promise<{ id: string }>;
  updateTenant(id: string, dto: UpdateTenantDto): Promise<void>;
  deleteTenant(id: string): Promise<void>;

  // User
  createUser(tenantId: string, dto: CreateUserDto): Promise<{ id: string }>;
  updateUser(tenantId: string, id: string, dto: UpdateUserDto): Promise<void>;
  deleteUser(tenantId: string, id: string): Promise<void>;

  // Role
  createRole(tenantId: string, dto: CreateRoleDto): Promise<{ id: string }>;
  updateRole(tenantId: string, id: string, dto: UpdateRoleDto): Promise<void>;
  deleteRole(tenantId: string, id: string): Promise<void>;

  // Permission
  createPermission(
    tenantId: string,
    dto: CreatePermissionDto,
  ): Promise<{ id: string }>;
  updatePermission(
    tenantId: string,
    id: string,
    dto: UpdatePermissionDto,
  ): Promise<void>;
  deletePermission(tenantId: string, id: string): Promise<void>;

  // Group
  createGroup(tenantId: string, dto: CreateGroupDto): Promise<{ id: string }>;
  updateGroup(tenantId: string, id: string, dto: UpdateGroupDto): Promise<void>;
  deleteGroup(tenantId: string, id: string): Promise<void>;
}
