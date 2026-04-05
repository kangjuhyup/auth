import { Injectable } from '@nestjs/common';
import { EntityManager, ref } from '@mikro-orm/core';
import { RoleAssignmentRepository } from '@domain/repositories';
import { RoleModel } from '@domain/models/role';
import { UserRoleOrmEntity } from '../mikro-orm/entities/user-role';
import { GroupRoleOrmEntity } from '../mikro-orm/entities/group-role';
import { UserOrmEntity } from '../mikro-orm/entities/user';
import { RoleOrmEntity } from '../mikro-orm/entities/role';
import { GroupOrmEntity } from '../mikro-orm/entities/group';
import { RoleMapper } from './mapper/role.mapper';

@Injectable()
export class RoleAssignmentRepositoryImpl implements RoleAssignmentRepository {
  constructor(private readonly em: EntityManager) {}

  async assignToUser(params: {
    userId: string;
    roleId: string;
  }): Promise<void> {
    const entity = new UserRoleOrmEntity();
    entity.user = ref(this.em.getReference(UserOrmEntity, params.userId));
    entity.role = ref(this.em.getReference(RoleOrmEntity, params.roleId));
    await this.em.persist(entity).flush();
  }

  async removeFromUser(params: {
    userId: string;
    roleId: string;
  }): Promise<void> {
    const entity = await this.em.findOneOrFail(UserRoleOrmEntity, {
      user: { id: params.userId },
      role: { id: params.roleId },
    });
    await this.em.remove(entity).flush();
  }

  async assignToGroup(params: {
    groupId: string;
    roleId: string;
  }): Promise<void> {
    const entity = new GroupRoleOrmEntity();
    entity.group = ref(this.em.getReference(GroupOrmEntity, params.groupId));
    entity.role = ref(this.em.getReference(RoleOrmEntity, params.roleId));
    await this.em.persist(entity).flush();
  }

  async removeFromGroup(params: {
    groupId: string;
    roleId: string;
  }): Promise<void> {
    const entity = await this.em.findOneOrFail(GroupRoleOrmEntity, {
      group: { id: params.groupId },
      role: { id: params.roleId },
    });
    await this.em.remove(entity).flush();
  }

  async existsForUser(params: { userId: string; roleId: string }): Promise<boolean> {
    const count = await this.em.count(UserRoleOrmEntity, {
      user: { id: params.userId },
      role: { id: params.roleId },
    });
    return count > 0;
  }

  async existsForGroup(params: { groupId: string; roleId: string }): Promise<boolean> {
    const count = await this.em.count(GroupRoleOrmEntity, {
      group: { id: params.groupId },
      role: { id: params.roleId },
    });
    return count > 0;
  }

  async listForUser(userId: string): Promise<RoleModel[]> {
    const entries = await this.em.find(
      UserRoleOrmEntity,
      { user: { id: userId } },
      { populate: ['role', 'role.tenant'] },
    );
    return entries.map((e) => RoleMapper.toDomain(e.role.unwrap()));
  }

  async listForGroup(groupId: string): Promise<RoleModel[]> {
    const entries = await this.em.find(
      GroupRoleOrmEntity,
      { group: { id: groupId } },
      { populate: ['role', 'role.tenant'] },
    );
    return entries.map((e) => RoleMapper.toDomain(e.role.unwrap()));
  }
}
