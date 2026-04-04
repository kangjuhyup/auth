import { Entity, OneToOne, PrimaryKeyProp, Property } from '@mikro-orm/core';
import { TenantOrmEntity } from './tenant';

export type SignupPolicy = 'invite' | 'open';

@Entity({ tableName: 'tenant_config' })
export class TenantConfigOrmEntity {
  [PrimaryKeyProp]?: 'tenant';

  @OneToOne(() => TenantOrmEntity, { fieldName: 'tenant_id', primary: true, deleteRule: 'cascade', owner: true })
  tenant!: TenantOrmEntity;

  @Property({ fieldName: 'signup_policy', type: 'varchar', length: 10, default: 'open' })
  signupPolicy!: SignupPolicy;

  @Property({ fieldName: 'require_phone_verify', type: 'boolean', default: false })
  requirePhoneVerify!: boolean;

  @Property({ fieldName: 'brand_name', type: 'varchar', length: 128, nullable: true })
  brandName?: string | null;

  @Property({ fieldName: 'access_token_ttl_sec', type: 'int', default: 3600 })
  accessTokenTtlSec!: number;

  @Property({ fieldName: 'refresh_token_ttl_sec', type: 'int', default: 1209600 })
  refreshTokenTtlSec!: number;

  @Property({ type: 'json', nullable: true })
  extra?: Record<string, unknown> | null;
}
