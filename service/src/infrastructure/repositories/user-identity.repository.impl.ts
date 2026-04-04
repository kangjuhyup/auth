import { Injectable } from '@nestjs/common';
import { EntityManager, ref } from '@mikro-orm/core';
import { UserIdentityRepository } from '@domain/repositories';
import { UserIdentityModel } from '@domain/models/user-identity';
import { UserIdentityOrmEntity } from '../mikro-orm/entities/user-identity';
import { TenantOrmEntity } from '../mikro-orm/entities/tenant';
import { UserOrmEntity } from '../mikro-orm/entities/user';
import { UserIdentityMapper } from './mapper/user-identity.mapper';

@Injectable()
export class UserIdentityRepositoryImpl implements UserIdentityRepository {
  constructor(private readonly em: EntityManager) {}

  async findByProviderSub(
    tenantId: string,
    provider: string,
    providerSub: string,
  ): Promise<UserIdentityModel | null> {
    const entity = await this.em.findOne(
      UserIdentityOrmEntity,
      {
        tenant: { id: tenantId },
        provider: provider as any,
        providerSub,
      },
      { populate: ['tenant', 'user'] },
    );
    return entity ? UserIdentityMapper.toDomain(entity) : null;
  }

  async save(model: UserIdentityModel): Promise<UserIdentityModel> {
    if (model.id) {
      const existing = await this.em.findOneOrFail(UserIdentityOrmEntity, {
        id: model.id,
      });
      existing.email = model.email;
      existing.profileJson = model.profileJson;
      await this.em.flush();
      return UserIdentityMapper.toDomain(existing);
    }

    const entity = new UserIdentityOrmEntity();
    entity.tenant = ref(
      this.em.getReference(TenantOrmEntity, model.tenantId),
    );
    entity.user = ref(this.em.getReference(UserOrmEntity, model.userId));
    entity.provider = model.provider;
    entity.providerSub = model.providerSub;
    entity.email = model.email;
    entity.profileJson = model.profileJson;
    entity.linkedAt = model.linkedAt;

    await this.em.persist(entity).flush();
    return UserIdentityMapper.toDomain(entity);
  }
}
