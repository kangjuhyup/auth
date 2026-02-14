import { Entity, ManyToOne, PrimaryKeyProp } from '@mikro-orm/core';
import { RoleOrmEntity } from './role';
import { PermissionOrmEntity } from './permission';

@Entity({ tableName: 'role_permission' })
export class RolePermissionOrmEntity {
  [PrimaryKeyProp]?: ['role', 'permission'];

  @ManyToOne(() => RoleOrmEntity, { fieldName: 'role_id', primary: true, deleteRule: 'cascade' })
  role!: RoleOrmEntity;

  @ManyToOne(() => PermissionOrmEntity, { fieldName: 'permission_id', primary: true, deleteRule: 'cascade' })
  permission!: PermissionOrmEntity;
}
