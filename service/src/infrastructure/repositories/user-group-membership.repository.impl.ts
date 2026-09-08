import { Injectable } from '@nestjs/common';
import { EntityManager, ref } from '@mikro-orm/core';
import { UserGroupMembershipRepository } from '@domain/repositories';
import { GroupModel } from '@domain/models/group';
import { UserGroupOrmEntity } from '../mikro-orm/entities/user-group';
import { UserOrmEntity } from '../mikro-orm/entities/user';
import { GroupOrmEntity } from '../mikro-orm/entities/group';
import { GroupMapper } from './mapper/group.mapper';

@Injectable()
export class UserGroupMembershipRepositoryImpl implements UserGroupMembershipRepository {
  constructor(private readonly em: EntityManager) {}

  async add(params: { userId: string; groupId: string }): Promise<void> {
    const entity = new UserGroupOrmEntity();
    entity.user = ref(this.em.getReference(UserOrmEntity, params.userId));
    entity.group = ref(this.em.getReference(GroupOrmEntity, params.groupId));
    await this.em.persist(entity).flush();
  }

  async remove(params: { userId: string; groupId: string }): Promise<void> {
    await this.em.nativeDelete(UserGroupOrmEntity, {
      user: { id: params.userId },
      group: { id: params.groupId },
    });
  }

  async exists(params: { userId: string; groupId: string }): Promise<boolean> {
    return (
      (await this.em.count(UserGroupOrmEntity, {
        user: { id: params.userId },
        group: { id: params.groupId },
      })) > 0
    );
  }

  async listGroupsForUser(userId: string): Promise<GroupModel[]> {
    const entries = await this.em.find(
      UserGroupOrmEntity,
      { user: { id: userId } },
      { populate: ['group', 'group.tenant', 'group.parent'] },
    );
    return entries.map((entry) => GroupMapper.toDomain(entry.group.unwrap()));
  }
}
