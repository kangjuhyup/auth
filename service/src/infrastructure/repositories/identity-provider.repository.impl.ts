import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { IdentityProviderRepository } from '@domain/repositories';
import { IdentityProviderModel } from '@domain/models/identity-provider';
import { IdentityProviderOrmEntity } from '../mikro-orm/entities/indentity-provider';
import { IdentityProviderMapper } from './mapper/identity-provider.mapper';

@Injectable()
export class IdentityProviderRepositoryImpl
  implements IdentityProviderRepository
{
  constructor(private readonly em: EntityManager) {}

  async findByTenantAndProvider(
    tenantId: string,
    provider: string,
  ): Promise<IdentityProviderModel | null> {
    const entity = await this.em.findOne(
      IdentityProviderOrmEntity,
      { tenant: { id: tenantId }, provider: provider as any },
      { populate: ['tenant'] },
    );
    return entity ? IdentityProviderMapper.toDomain(entity) : null;
  }

  async listEnabledByTenant(
    tenantId: string,
  ): Promise<IdentityProviderModel[]> {
    const entities = await this.em.find(
      IdentityProviderOrmEntity,
      { tenant: { id: tenantId }, enabled: true },
      { populate: ['tenant'] },
    );
    return entities.map(IdentityProviderMapper.toDomain);
  }
}
