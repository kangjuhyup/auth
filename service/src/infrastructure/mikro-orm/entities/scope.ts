import {
  Entity,
  ManyToOne,
  PrimaryKey,
  Property,
  Ref,
  Unique,
} from '@mikro-orm/core';
import { BaseEntity } from '../base';
import { TenantOrmEntity } from './tenant';

@Entity({ tableName: 'scope' })
@Unique({ properties: ['tenant', 'name'], name: 'uk_scope_tenant_name' })
export class ScopeOrmEntity extends BaseEntity {
  @PrimaryKey({ type: 'bigint', autoincrement: true })
  id!: string;

  @ManyToOne(() => TenantOrmEntity, {
    fieldName: 'tenant_id',
    deleteRule: 'cascade',
    ref: true,
  })
  tenant!: Ref<TenantOrmEntity>;

  @Property({ type: 'varchar', length: 128, index: true })
  name!: string;

  @Property({ fieldName: 'display_name', type: 'varchar', length: 128 })
  displayName!: string;

  @Property({ type: 'varchar', length: 512, nullable: true })
  description?: string | null;

  @Property({ fieldName: 'claim_keys', type: 'json' })
  claimKeys: string[] = [];

  @Property({ type: 'boolean', default: true })
  enabled = true;

  @Property({ fieldName: 'built_in', type: 'boolean', default: false })
  builtIn = false;
}
