import {
  Entity,
  PrimaryKey,
  Property,
  Unique,
  OneToMany,
  Collection,
} from '@mikro-orm/core';
import { BaseEntity } from '../base';
import { ClientOrmEntity } from './client';
import { UserOrmEntity } from './user';
import { GroupOrmEntity } from './group';
import { RoleOrmEntity } from './role';
import { PermissionOrmEntity } from './permission';
import { IdentityProviderOrmEntity } from './identity-provider';
import { UserIdentityOrmEntity } from './user-identity';
import { TenantClientOrmEntity } from './tenant-client';

@Entity({ tableName: 'tenant' })
@Unique({ properties: ['code'], name: 'uk_tenant_code' })
export class TenantOrmEntity extends BaseEntity {
  @PrimaryKey({ type: 'bigint', autoincrement: true })
  id!: string;

  @Property({ type: 'varchar', length: 64, index: true })
  code!: string;

  @Property({ type: 'varchar', length: 128 })
  name!: string;

  @OneToMany(() => ClientOrmEntity, (c) => c.tenant)
  clients = new Collection<ClientOrmEntity>(this);

  @OneToMany(() => UserOrmEntity, (u) => u.tenant)
  users = new Collection<UserOrmEntity>(this);

  @OneToMany(() => GroupOrmEntity, (g) => g.tenant)
  groups = new Collection<GroupOrmEntity>(this);

  @OneToMany(() => RoleOrmEntity, (r) => r.tenant)
  roles = new Collection<RoleOrmEntity>(this);

  @OneToMany(() => PermissionOrmEntity, (p) => p.tenant)
  permissions = new Collection<PermissionOrmEntity>(this);

  @OneToMany(() => IdentityProviderOrmEntity, (i) => i.tenant)
  idps = new Collection<IdentityProviderOrmEntity>(this);

  @OneToMany(() => UserIdentityOrmEntity, (ui) => ui.tenant)
  userIdentities = new Collection<UserIdentityOrmEntity>(this);

  @OneToMany(() => TenantClientOrmEntity, (tc) => tc.tenant)
  tenantClients = new Collection<TenantClientOrmEntity>(this);
}
