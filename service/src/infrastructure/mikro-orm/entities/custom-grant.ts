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
import type { ApplicationType, ClientType } from '@domain/models/client';

@Entity({ tableName: 'custom_grant' })
@Unique({
  properties: ['tenant', 'grantType'],
  name: 'uk_custom_grant_tenant_grant_type',
})
export class CustomGrantOrmEntity extends BaseEntity {
  @PrimaryKey({ type: 'bigint', autoincrement: true })
  id!: string;

  @ManyToOne(() => TenantOrmEntity, {
    fieldName: 'tenant_id',
    deleteRule: 'cascade',
    ref: true,
  })
  tenant!: Ref<TenantOrmEntity>;

  @Property({ fieldName: 'grant_type', type: 'varchar', length: 192 })
  grantType!: string;

  @Property({ fieldName: 'display_name', type: 'varchar', length: 128 })
  displayName!: string;

  @Property({ type: 'varchar', length: 512, nullable: true })
  description?: string | null;

  @Property({ type: 'boolean', default: true })
  enabled = true;

  @Property({ fieldName: 'allowed_client_types', type: 'json' })
  allowedClientTypes: ClientType[] = [];

  @Property({ fieldName: 'allowed_application_types', type: 'json' })
  allowedApplicationTypes: ApplicationType[] = [];

  @Property({ fieldName: 'requires_client_authentication', type: 'boolean' })
  requiresClientAuthentication = true;

  @Property({ fieldName: 'requires_grant_types', type: 'json' })
  requiresGrantTypes: string[] = [];

  @Property({ fieldName: 'built_in', type: 'boolean', default: false })
  builtIn = false;
}
