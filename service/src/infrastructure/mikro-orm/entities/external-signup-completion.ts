import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Unique,
  type Ref,
} from '@mikro-orm/core';
import { BaseEntity } from '../base';
import { TenantOrmEntity } from './tenant';
import { UserOrmEntity } from './user';
@Entity({ tableName: 'external_signup_completion' })
@Unique({
  properties: ['tenant', 'consumerClientId', 'keyHash'],
  name: 'uk_external_signup_completion',
})
export class ExternalSignupCompletionOrmEntity extends BaseEntity {
  @PrimaryKey({ type: 'char', length: 26 }) id!: string;
  @ManyToOne(() => TenantOrmEntity, {
    fieldName: 'tenant_id',
    ref: true,
    deleteRule: 'restrict',
  })
  tenant!: Ref<TenantOrmEntity>;
  @ManyToOne(() => UserOrmEntity, {
    fieldName: 'user_id',
    ref: true,
    deleteRule: 'restrict',
  })
  user!: Ref<UserOrmEntity>;
  @Property({ type: 'varchar', length: 191 }) consumerClientId!: string;
  @Property({ type: 'varchar', length: 191 }) clientId!: string;
  @Property({ type: 'char', length: 64 }) keyHash!: string;
  @Property({ type: 'varchar', length: 64 }) provider!: string;
  @Property({ type: 'varchar', length: 191 }) providerSub!: string;
}
