import { Injectable } from '@nestjs/common';
import { EntityManager, ref } from '@mikro-orm/core';
import { ClientAuthPolicyRepository } from '@domain/repositories';
import { ClientAuthPolicyModel } from '@domain/models/client-auth-policy';
import { ClientAuthPolicyOrmEntity } from '../mikro-orm/entities/client-auth-policy';
import { ClientOrmEntity } from '../mikro-orm/entities/client';
import { TenantOrmEntity } from '../mikro-orm/entities/tenant';
import { ClientAuthPolicyMapper } from './mapper/client-auth-policy.mapper';

@Injectable()
export class ClientAuthPolicyRepositoryImpl implements ClientAuthPolicyRepository {
  constructor(private readonly em: EntityManager) {}

  async findByClientRefId(clientRefId: string): Promise<ClientAuthPolicyModel | null> {
    const entity = await this.em.findOne(
      ClientAuthPolicyOrmEntity,
      { client: { id: clientRefId } },
      { populate: ['tenant', 'client'] },
    );
    return entity ? ClientAuthPolicyMapper.toDomain(entity) : null;
  }

  async save(policy: ClientAuthPolicyModel): Promise<ClientAuthPolicyModel> {
    if (policy.id) {
      const existing = await this.em.findOneOrFail(
        ClientAuthPolicyOrmEntity,
        { id: policy.id },
        { populate: ['tenant', 'client'] },
      );
      ClientAuthPolicyMapper.toOrm(policy, existing);
      await this.em.flush();
      return ClientAuthPolicyMapper.toDomain(existing);
    } else {
      const entity = ClientAuthPolicyMapper.toOrm(policy);
      entity.tenant = ref(
        this.em.getReference(TenantOrmEntity, policy.tenantId),
      );
      entity.client = ref(
        this.em.getReference(ClientOrmEntity, policy.clientRefId),
      );
      await this.em.persist(entity).flush();
      return ClientAuthPolicyMapper.toDomain(entity);
    }
  }

  async deleteByClientRefId(clientRefId: string): Promise<void> {
    const entity = await this.em.findOne(
      ClientAuthPolicyOrmEntity,
      { client: { id: clientRefId } },
    );
    if (entity) {
      await this.em.remove(entity).flush();
    }
  }
}
