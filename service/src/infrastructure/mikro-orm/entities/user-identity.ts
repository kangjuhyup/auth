import { Entity, PrimaryKey, Property, ManyToOne, Unique } from '@mikro-orm/core';
import { BaseEntity } from '../base';
import { TenantOrmEntity } from './tenant';
import { UserOrmEntity } from './user';
import { IdpProvider } from './indentity-provider';

@Entity({ tableName: 'user_identity' })
@Unique({ properties: ['tenant', 'provider', 'providerSub'], name: 'uk_user_identity' })
export class UserIdentityOrmEntity extends BaseEntity {
  @PrimaryKey({ type: 'bigint', autoincrement: true })
  id!: string;

  @ManyToOne(() => TenantOrmEntity, { fieldName: 'tenant_id', deleteRule: 'restrict' })
  tenant!: TenantOrmEntity;

  @ManyToOne(() => UserOrmEntity, { fieldName: 'user_id', deleteRule: 'cascade' })
  user!: UserOrmEntity;

  @Property({ type: 'varchar', length: 20 })
  provider!: IdpProvider;

  @Property({ fieldName: 'provider_sub', type: 'varchar', length: 191, index: true })
  providerSub!: string;

  @Property({ type: 'varchar', length: 191, nullable: true })
  email?: string | null;

  @Property({ fieldName: 'profile_json', type: 'json', nullable: true })
  profileJson?: Record<string, unknown> | null;

  @Property({ fieldName: 'linked_at', defaultRaw: 'CURRENT_TIMESTAMP' })
  linkedAt: Date = new Date();
}
