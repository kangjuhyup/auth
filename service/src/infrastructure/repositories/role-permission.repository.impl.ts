import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { RolePermissionRepository, RolePermissionListQuery } from '@domain/repositories';
import { PermissionModel } from '@domain/models/permission';
import { RolePermissionOrmEntity } from '../mikro-orm/entities/role-permission';
import { RoleOrmEntity } from '../mikro-orm/entities/role';
import { PermissionOrmEntity } from '../mikro-orm/entities/permission';
import { PermissionMapper } from './permission.mapper';

@Injectable()
export class RolePermissionRepositoryImpl implements RolePermissionRepository {
  constructor(private readonly em: EntityManager) {}

  async add(params: { roleId: string; permissionId: string }): Promise<void> {
    const entity = new RolePermissionOrmEntity();
    entity.role = this.em.getReference(RoleOrmEntity, params.roleId);
    entity.permission = this.em.getReference(PermissionOrmEntity, params.permissionId);
    await this.em.persist(entity).flush();
  }

  async remove(params: { roleId: string; permissionId: string }): Promise<void> {
    const entity = await this.em.findOneOrFail(RolePermissionOrmEntity, {
      role: { id: params.roleId },
      permission: { id: params.permissionId },
    });
    await this.em.remove(entity).flush();
  }

  async exists(params: { roleId: string; permissionId: string }): Promise<boolean> {
    const count = await this.em.count(RolePermissionOrmEntity, {
      role: { id: params.roleId },
      permission: { id: params.permissionId },
    });
    return count > 0;
  }

  async listByRole(
    query: RolePermissionListQuery,
  ): Promise<{ items: PermissionModel[]; total: number }> {
    const offset = (query.page - 1) * query.limit;
    const [entities, total] = await this.em.findAndCount(
      RolePermissionOrmEntity,
      { role: { id: query.roleId } },
      { populate: ['permission', 'permission.tenant'], limit: query.limit, offset },
    );
    return {
      items: entities.map((rp) =>
        PermissionMapper.toDomain(rp.permission.unwrap()),
      ),
      total,
    };
  }
}
