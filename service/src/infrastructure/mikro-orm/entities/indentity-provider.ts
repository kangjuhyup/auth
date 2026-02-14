import { Entity, PrimaryKey, Property, ManyToOne, Unique } from '@mikro-orm/core';
import { BaseEntity } from '../base';
import { TenantOrmEntity } from './tenant';

export type IdpProvider = 'kakao' | 'naver' | 'google' | 'apple';

@Entity({ tableName: 'identity_provider' })
@Unique({ properties: ['tenant', 'provider'], name: 'uk_idp' })
export class IdentityProviderOrmEntity extends BaseEntity {
  @PrimaryKey({ type: 'bigint', autoincrement: true })
  id!: string;

  @ManyToOne(() => TenantOrmEntity, { fieldName: 'tenant_id', deleteRule: 'restrict' })
  tenant!: TenantOrmEntity;

  @Property({ type: 'varchar', length: 20 })
  provider!: IdpProvider;

  @Property({ fieldName: 'client_id', type: 'varchar', length: 191 })
  clientId!: string;

  @Property({ fieldName: 'client_secret', type: 'varchar', length: 255, nullable: true })
  clientSecret?: string | null;

  @Property({ fieldName: 'redirect_uri', type: 'varchar', length: 255 })
  redirectUri!: string;

  @Property({ type: 'boolean', default: true })
  enabled!: boolean;
}
