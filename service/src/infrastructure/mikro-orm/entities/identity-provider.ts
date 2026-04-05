import { Entity, PrimaryKey, Property, ManyToOne, Unique, Ref } from '@mikro-orm/core';
import type {
  IdpOauthEndpointsConfig,
  IdpProvider,
} from '@domain/models/identity-provider';
import { BaseEntity } from '../base';
import { TenantOrmEntity } from './tenant';

@Entity({ tableName: 'identity_provider' })
@Unique({ properties: ['tenant', 'provider'], name: 'uk_idp' })
export class IdentityProviderOrmEntity extends BaseEntity {
  @PrimaryKey({ type: 'bigint', autoincrement: true })
  id!: string;

  @ManyToOne(() => TenantOrmEntity, { fieldName: 'tenant_id', deleteRule: 'restrict', ref: true })
  tenant!: Ref<TenantOrmEntity>;

  @Property({ type: 'varchar', length: 64 })
  provider!: IdpProvider;

  @Property({ fieldName: 'display_name', type: 'varchar', length: 50 })
  displayName!: string;

  @Property({ fieldName: 'client_id', type: 'varchar', length: 191 })
  clientId!: string;

  @Property({ fieldName: 'client_secret', type: 'varchar', length: 255, nullable: true })
  clientSecret?: string | null;

  @Property({ fieldName: 'redirect_uri', type: 'varchar', length: 255 })
  redirectUri!: string;

  @Property({ type: 'boolean', default: true })
  enabled!: boolean;

  @Property({ fieldName: 'oauth_config', type: 'json', nullable: true })
  oauthConfig?: IdpOauthEndpointsConfig | null;
}
