import { Entity, PrimaryKey, Property, ManyToOne, OneToMany, Collection, Unique } from '@mikro-orm/core';
import { BaseEntity } from '../base';
import { TenantOrmEntity } from './tenant';
import { RoleInheritOrmEntity } from './role-inherit';
import { RolePermissionOrmEntity } from './role-permission';
import { UserRoleOrmEntity } from './user-role';
import { GroupRoleOrmEntity } from './group-role';

@Entity({ tableName: 'role' })
@Unique({ properties: ['tenant', 'code'], name: 'uk_role_tenant_code' })
export class RoleOrmEntity extends BaseEntity {
  @PrimaryKey({ type: 'bigint', autoincrement: true })
  id!: string;

  @ManyToOne(() => TenantOrmEntity, { fieldName: 'tenant_id', deleteRule: 'restrict' })
  tenant!: TenantOrmEntity;

  @Property({ type: 'varchar', length: 128, index: true })
  code!: string;

  @Property({ type: 'varchar', length: 128 })
  name!: string;

  @Property({ type: 'varchar', length: 255, nullable: true })
  description?: string | null;

  @OneToMany(() => RolePermissionOrmEntity, (rp) => rp.role)
  rolePermissions = new Collection<RolePermissionOrmEntity>(this);

  @OneToMany(() => UserRoleOrmEntity, (ur) => ur.role)
  userRoles = new Collection<UserRoleOrmEntity>(this);

  @OneToMany(() => GroupRoleOrmEntity, (gr) => gr.role)
  groupRoles = new Collection<GroupRoleOrmEntity>(this);

  @OneToMany(() => RoleInheritOrmEntity, (ri) => ri.parent)
  includes = new Collection<RoleInheritOrmEntity>(this);

  @OneToMany(() => RoleInheritOrmEntity, (ri) => ri.child)
  includedBy = new Collection<RoleInheritOrmEntity>(this);
}
