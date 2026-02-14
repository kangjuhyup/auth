import { Entity, PrimaryKey, Property, ManyToOne, OneToMany, Collection, Unique } from '@mikro-orm/core';
import { BaseEntity } from '../base';
import { TenantOrmEntity } from './tenant';
import { RolePermissionOrmEntity } from './role-permission';

@Entity({ tableName: 'permission' })
@Unique({ properties: ['tenant', 'code'], name: 'uk_perm_tenant_code' })
export class PermissionOrmEntity extends BaseEntity {
  @PrimaryKey({ type: 'bigint', autoincrement: true })
  id!: string;

  @ManyToOne(() => TenantOrmEntity, { fieldName: 'tenant_id', deleteRule: 'restrict' })
  tenant!: TenantOrmEntity;

  @Property({ type: 'varchar', length: 128, index: true })
  code!: string;

  @Property({ type: 'varchar', length: 128, nullable: true, index: true })
  resource?: string | null;

  @Property({ type: 'varchar', length: 64, nullable: true, index: true })
  action?: string | null;

  @Property({ type: 'varchar', length: 255, nullable: true })
  description?: string | null;

  @OneToMany(() => RolePermissionOrmEntity, (rp) => rp.permission)
  rolePermissions = new Collection<RolePermissionOrmEntity>(this);
}
