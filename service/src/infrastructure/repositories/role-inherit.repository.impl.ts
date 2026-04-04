import { Injectable } from '@nestjs/common';
import { EntityManager, ref } from '@mikro-orm/core';
import { RoleInheritRepository } from '@domain/repositories/role-inherit.repository';
import { RoleInheritOrmEntity } from '../mikro-orm/entities/role-inherit';
import { RoleOrmEntity } from '../mikro-orm/entities/role';

@Injectable()
export class RoleInheritRepositoryImpl implements RoleInheritRepository {
  constructor(private readonly em: EntityManager) {}

  async addInheritance(params: {
    parentRoleId: string;
    childRoleId: string;
  }): Promise<void> {
    const entity = new RoleInheritOrmEntity();
    entity.parent = ref(this.em.getReference(RoleOrmEntity, params.parentRoleId));
    entity.child = ref(this.em.getReference(RoleOrmEntity, params.childRoleId));
    await this.em.persist(entity).flush();
  }

  async removeInheritance(params: {
    parentRoleId: string;
    childRoleId: string;
  }): Promise<void> {
    const entity = await this.em.findOne(RoleInheritOrmEntity, {
      parent: params.parentRoleId,
      child: params.childRoleId,
    } as any);
    if (entity) {
      await this.em.remove(entity).flush();
    }
  }

  async getChildRoleIds(parentRoleId: string): Promise<string[]> {
    const entities = await this.em.find(RoleInheritOrmEntity, {
      parent: parentRoleId,
    } as any, { populate: ['child'] });
    return entities.map((e) => e.child.id);
  }

  async getParentRoleIds(childRoleId: string): Promise<string[]> {
    const entities = await this.em.find(RoleInheritOrmEntity, {
      child: childRoleId,
    } as any, { populate: ['parent'] });
    return entities.map((e) => e.parent.id);
  }

  async resolveAllRoleIds(roleId: string): Promise<string[]> {
    const visited = new Set<string>();
    const queue = [roleId];

    while (queue.length > 0) {
      const current = queue.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const childIds = await this.getChildRoleIds(current);
      for (const childId of childIds) {
        if (!visited.has(childId)) {
          queue.push(childId);
        }
      }
    }

    return Array.from(visited);
  }
}
