import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { RoleAssignmentRepository } from '@domain/repositories';
import { UserRoleOrmEntity } from '../mikro-orm/entities/user-role';
import { GroupRoleOrmEntity } from '../mikro-orm/entities/group-role';
import { UserOrmEntity } from '../mikro-orm/entities/user';
import { RoleOrmEntity } from '../mikro-orm/entities/role';
import { GroupOrmEntity } from '../mikro-orm/entities/group';

@Injectable()
export class RoleAssignmentRepositoryImpl implements RoleAssignmentRepository {
  constructor(private readonly em: EntityManager) {}

  async assignToUser(params: { userId: string; roleId: string }): Promise<void> {
    const entity = new UserRoleOrmEntity();
    entity.user = this.em.getReference(UserOrmEntity, params.userId);
    entity.role = this.em.getReference(RoleOrmEntity, params.roleId);
    await this.em.persist(entity).flush();
  }

  async removeFromUser(params: { userId: string; roleId: string }): Promise<void> {
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
    entity.group = this.em.getReference(GroupOrmEntity, params.groupId);
    entity.role = this.em.getReference(RoleOrmEntity, params.roleId);
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
}
