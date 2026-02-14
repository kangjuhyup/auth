import { Entity, PrimaryKey, Property, ManyToOne, OneToMany, Collection, Unique } from '@mikro-orm/core';
import { BaseEntity } from '../base';
import { TenantOrmEntity } from './tenant';
import { UserGroupOrmEntity } from './user-group';
import { GroupRoleOrmEntity } from './group-role';

@Entity({ tableName: 'group' })
@Unique({ properties: ['tenant', 'code'], name: 'uk_grp_tenant_code' })
export class GroupOrmEntity extends BaseEntity {
  @PrimaryKey({ type: 'bigint', autoincrement: true })
  id!: string;

  @ManyToOne(() => TenantOrmEntity, { fieldName: 'tenant_id', deleteRule: 'restrict' })
  tenant!: TenantOrmEntity;

  @Property({ type: 'varchar', length: 128, index: true })
  code!: string;

  @Property({ type: 'varchar', length: 128 })
  name!: string;

  @ManyToOne(() => GroupOrmEntity, { fieldName: 'parent_id', nullable: true, deleteRule: 'set null' })
  parent?: GroupOrmEntity | null;

  @OneToMany(() => GroupOrmEntity, (g) => g.parent)
  children = new Collection<GroupOrmEntity>(this);

  @OneToMany(() => UserGroupOrmEntity, (ug) => ug.group)
  userGroups = new Collection<UserGroupOrmEntity>(this);

  @OneToMany(() => GroupRoleOrmEntity, (gr) => gr.group)
  groupRoles = new Collection<GroupRoleOrmEntity>(this);
}
