import { NotFoundException } from '@nestjs/common';
import { AdminQueryPort } from '../ports/admin-query.port';
import {
  PaginationQuery,
  PaginatedResult,
  TenantResponse,
  ClientResponse,
  UserResponse,
  RoleResponse,
  PermissionResponse,
  GroupResponse,
} from '@application/dto';
import { TenantRepository, GroupRepository, RoleRepository, PermissionRepository, RolePermissionRepository } from '@domain/repositories';

export class AdminQueryHandler implements AdminQueryPort {
  constructor(
    private readonly tenantRepo: TenantRepository,
    private readonly groupRepo: GroupRepository,
    private readonly roleRepo: RoleRepository,
    private readonly permissionRepo: PermissionRepository,
    private readonly rolePermissionRepo: RolePermissionRepository,
  ) {}

  // ── Tenant ──────────────────────────────────────────────────────────────

  async getTenants(
    query: PaginationQuery,
  ): Promise<PaginatedResult<TenantResponse>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const { items, total } = await this.tenantRepo.list({ page, limit });

    return {
      items: items.map((t) => ({
        id: t.id,
        code: t.code,
        name: t.name,
        signupPolicy: 'open',
        requirePhoneVerify: false,
        brandName: null,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
      total,
      page,
      limit,
    };
  }

  async getTenant(id: string): Promise<TenantResponse> {
    const tenant = await this.tenantRepo.findById(id);
    if (!tenant) throw new NotFoundException('Tenant not found');

    return {
      id: tenant.id,
      code: tenant.code,
      name: tenant.name,
      signupPolicy: 'open',
      requirePhoneVerify: false,
      brandName: null,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    };
  }

  // ── Not implemented ──────────────────────────────────────────────────────

  getClients(_tenantId: string, _query: PaginationQuery): Promise<PaginatedResult<ClientResponse>> {
    throw new Error('Method not implemented.');
  }

  getClient(_tenantId: string, _id: string): Promise<ClientResponse> {
    throw new Error('Method not implemented.');
  }

  getKeys(_tenantId: string): Promise<unknown[]> {
    throw new Error('Method not implemented.');
  }

  getPolicies(_tenantId: string): Promise<Record<string, unknown>> {
    throw new Error('Method not implemented.');
  }

  getAuditLogs(
    _tenantId: string,
    _query: PaginationQuery,
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    throw new Error('Method not implemented.');
  }

  getUsers(_tenantId: string, _query: PaginationQuery): Promise<PaginatedResult<UserResponse>> {
    throw new Error('Method not implemented.');
  }

  getUser(_tenantId: string, _id: string): Promise<UserResponse> {
    throw new Error('Method not implemented.');
  }

  async getRoles(
    tenantId: string,
    query: PaginationQuery,
  ): Promise<PaginatedResult<RoleResponse>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const { items, total } = await this.roleRepo.list({ tenantId, page, limit });

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
    const role = await this.roleRepo.findById(id);
    if (!role || role.tenantId !== tenantId)
      throw new NotFoundException('Role not found');

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
    const role = await this.roleRepo.findById(roleId);
    if (!role || role.tenantId !== tenantId)
      throw new NotFoundException('Role not found');

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const { items, total } = await this.rolePermissionRepo.listByRole({ roleId, page, limit });

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

    const { items, total } = await this.permissionRepo.list({ tenantId, page, limit });

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

  async getPermission(tenantId: string, id: string): Promise<PermissionResponse> {
    const permission = await this.permissionRepo.findById(id);
    if (!permission || permission.tenantId !== tenantId)
      throw new NotFoundException('Permission not found');

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

    const { items, total } = await this.groupRepo.list({ tenantId, page, limit });

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
    const group = await this.groupRepo.findById(id);
    if (!group || group.tenantId !== tenantId)
      throw new NotFoundException('Group not found');

    return {
      id: group.id,
      code: group.code,
      name: group.name,
      parentId: group.parentId ?? null,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
    };
  }
}
