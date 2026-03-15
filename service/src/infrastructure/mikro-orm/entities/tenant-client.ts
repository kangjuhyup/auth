import { Entity, PrimaryKey, Property, ManyToOne, Unique, Ref } from '@mikro-orm/core';
import { BaseEntity } from '../base';
import { TenantOrmEntity } from './tenant';
import { ClientOrmEntity } from './client';

@Entity({ tableName: 'tenant_client' })
@Unique({ properties: ['tenant', 'client'], name: 'uk_tc' })
export class TenantClientOrmEntity extends BaseEntity {
  @PrimaryKey({ type: 'bigint', autoincrement: true })
  id!: string;

  @ManyToOne(() => TenantOrmEntity, { fieldName: 'tenant_id', deleteRule: 'cascade', ref: true })
  tenant!: Ref<TenantOrmEntity>;

  @ManyToOne(() => ClientOrmEntity, { fieldName: 'client_id', deleteRule: 'cascade', ref: true })
  client!: Ref<ClientOrmEntity>;

  @Property({ type: 'boolean', default: true })
  enabled!: boolean;
}
