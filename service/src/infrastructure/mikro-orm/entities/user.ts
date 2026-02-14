import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  OneToMany,
  Collection,
  Unique,
} from '@mikro-orm/core';
import { BaseEntity } from '../base';
import { TenantOrmEntity } from './tenant';
import { UserGroupOrmEntity } from './user-group';
import { UserRoleOrmEntity } from './user-role';
import { UserIdentityOrmEntity } from './user-identity';
import { UserCredentialOrmEntity } from './user-credential';
import { ulid } from 'ulid';

export type UserStatus = 'ACTIVE' | 'LOCKED' | 'DISABLED' | 'WITHDRAWN';

@Entity({ tableName: 'user' })
@Unique({ properties: ['tenant', 'username'], name: 'uk_user_tenant_username' })
@Unique({ properties: ['tenant', 'email'], name: 'uk_user_tenant_email' })
export class UserOrmEntity extends BaseEntity {
  @PrimaryKey({ type: 'char', length: 26 })
  id: string = ulid();

  @ManyToOne(() => TenantOrmEntity, {
    fieldName: 'tenant_id',
    deleteRule: 'restrict',
  })
  tenant!: TenantOrmEntity;

  @Property({ type: 'varchar', length: 128, index: true })
  username!: string;

  @Property({ type: 'varchar', length: 191, nullable: true })
  email?: string | null;

  @Property({ fieldName: 'email_verified', type: 'boolean', default: false })
  emailVerified!: boolean;

  @Property({ type: 'varchar', length: 32, nullable: true })
  phone?: string | null;

  @Property({ fieldName: 'phone_verified', type: 'boolean', default: false })
  phoneVerified!: boolean;

  @Property({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status!: UserStatus;

  @OneToMany(() => UserCredentialOrmEntity, (uc) => uc.user)
  credentials = new Collection<UserCredentialOrmEntity>(this);

  @OneToMany(() => UserGroupOrmEntity, (ug) => ug.user)
  userGroups = new Collection<UserGroupOrmEntity>(this);

  @OneToMany(() => UserRoleOrmEntity, (ur) => ur.user)
  userRoles = new Collection<UserRoleOrmEntity>(this);

  @OneToMany(() => UserIdentityOrmEntity, (ui) => ui.user)
  identities = new Collection<UserIdentityOrmEntity>(this);
}
