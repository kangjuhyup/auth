import { Entity, ManyToOne, PrimaryKeyProp, Ref } from '@mikro-orm/core';
import { RoleOrmEntity } from './role';
import { PermissionOrmEntity } from './permission';

@Entity({ tableName: 'role_permission' })
export class RolePermissionOrmEntity {
  [PrimaryKeyProp]?: ['role', 'permission'];

  @ManyToOne(() => RoleOrmEntity, { fieldName: 'role_id', primary: true, deleteRule: 'cascade', ref: true })
  role!: Ref<RoleOrmEntity>;

  @ManyToOne(() => PermissionOrmEntity, { fieldName: 'permission_id', primary: true, deleteRule: 'cascade', ref: true })
  permission!: Ref<PermissionOrmEntity>;
}
