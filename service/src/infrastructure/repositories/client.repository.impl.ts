import { Injectable } from '@nestjs/common';
import { EntityManager, ref } from '@mikro-orm/core';
import { ClientRepository, ClientListQuery } from '@domain/repositories';
import { ClientModel } from '@domain/models/client';
import { ClientOrmEntity } from '../mikro-orm/entities/client';
import { TenantOrmEntity } from '../mikro-orm/entities/tenant';
import { ClientMapper } from './mapper/client.mapper';

@Injectable()
export class ClientRepositoryImpl implements ClientRepository {
  constructor(private readonly em: EntityManager) {}

  async findById(id: string): Promise<ClientModel | null> {
    const entity = await this.em.findOne(
      ClientOrmEntity,
      { id },
      { populate: ['tenant'] },
    );
    return entity ? ClientMapper.toDomain(entity) : null;
  }

  async findByClientId(
    tenantId: string,
    clientId: string,
  ): Promise<ClientModel | null> {
    const entity = await this.em.findOne(
      ClientOrmEntity,
      { tenant: { id: tenantId }, clientId },
      { populate: ['tenant'] },
    );
    return entity ? ClientMapper.toDomain(entity) : null;
  }

  async list(
    query: ClientListQuery,
  ): Promise<{ items: ClientModel[]; total: number }> {
    const offset = (query.page - 1) * query.limit;
    const [entities, total] = await this.em.findAndCount(
      ClientOrmEntity,
      { tenant: { id: query.tenantId } },
      { populate: ['tenant'], limit: query.limit, offset },
    );
    return { items: entities.map(ClientMapper.toDomain), total };
  }

  async save(client: ClientModel): Promise<ClientModel> {
    if (client.id) {
      const existing = await this.em.findOneOrFail(
        ClientOrmEntity,
        { id: client.id },
        { populate: ['tenant'] },
      );
      ClientMapper.toOrm(client, existing);
      await this.em.flush();
      return ClientMapper.toDomain(existing);
    } else {
      const entity = ClientMapper.toOrm(client);
      entity.tenant = ref(
        this.em.getReference(TenantOrmEntity, client.tenantId),
      );
      await this.em.persist(entity).flush();
      return ClientMapper.toDomain(entity);
    }
  }

  async delete(id: string): Promise<void> {
    const entity = await this.em.findOneOrFail(ClientOrmEntity, { id });
    await this.em.remove(entity).flush();
  }
}
