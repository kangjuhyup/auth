import { Entity, PrimaryKey, Property, ManyToOne, OneToMany, Collection, Unique, Ref } from '@mikro-orm/core';
import { BaseEntity } from '../base';
import { TenantOrmEntity } from './tenant';
import { UserRoleOrmEntity } from './user-role';
import { GroupRoleOrmEntity } from './group-role';
import { TenantClientOrmEntity } from './tenant-client';

export type ClientType = 'confidential' | 'public' | 'service';
export type ApplicationType = 'web' | 'native';

@Entity({ tableName: 'client' })
@Unique({ properties: ['tenant', 'clientId'], name: 'uk_client_tenant_clientid' })
export class ClientOrmEntity extends BaseEntity {
  @PrimaryKey({ type: 'bigint', autoincrement: true })
  id!: string;

  @ManyToOne(() => TenantOrmEntity, { fieldName: 'tenant_id', deleteRule: 'restrict', ref: true })
  tenant!: Ref<TenantOrmEntity>;

  @Property({ fieldName: 'client_id', type: 'varchar', length: 128, index: true })
  clientId!: string;

  @Property({ fieldName: 'secret_enc', type: 'varchar', length: 512, nullable: true })
  secretEnc?: string | null;

  @Property({ type: 'varchar', length: 128 })
  name!: string;

  @Property({ type: 'varchar', length: 20, default: 'public' })
  type!: ClientType;

  @Property({ type: 'boolean', default: true })
  enabled!: boolean;

  @Property({ fieldName: 'redirect_uris', type: 'json', default: '[]' })
  redirectUris!: string[];

  @Property({
    fieldName: 'grant_types',
    type: 'json',
    default: '["authorization_code"]',
  })
  grantTypes!: string[];

  @Property({ fieldName: 'response_types', type: 'json', default: '["code"]' })
  responseTypes!: string[];

  @Property({
    fieldName: 'token_endpoint_auth_method',
    type: 'varchar',
    length: 40,
    default: 'none',
  })
  tokenEndpointAuthMethod!: string;

  @Property({ type: 'varchar', length: 512, default: 'openid' })
  scope!: string;

  @Property({
    fieldName: 'post_logout_redirect_uris',
    type: 'json',
    default: '[]',
  })
  postLogoutRedirectUris!: string[];

  @Property({
    fieldName: 'application_type',
    type: 'varchar',
    length: 10,
    default: 'web',
  })
  applicationType!: ApplicationType;

  @Property({ fieldName: 'backchannel_logout_uri', type: 'varchar', length: 512, nullable: true })
  backchannelLogoutUri?: string | null;

  @Property({ fieldName: 'frontchannel_logout_uri', type: 'varchar', length: 512, nullable: true })
  frontchannelLogoutUri?: string | null;

  @Property({ fieldName: 'allowed_resources', type: 'json', default: '[]' })
  allowedResources!: string[];

  @Property({ fieldName: 'skip_consent', type: 'boolean', default: false })
  skipConsent!: boolean;

  @OneToMany(() => UserRoleOrmEntity, (ur) => ur.client)
  userRoles = new Collection<UserRoleOrmEntity>(this);

  @OneToMany(() => GroupRoleOrmEntity, (gr) => gr.client)
  groupRoles = new Collection<GroupRoleOrmEntity>(this);

  @OneToMany(() => TenantClientOrmEntity, (tc) => tc.client)
  tenantClients = new Collection<TenantClientOrmEntity>(this);
}
