import { Entity, ManyToOne, PrimaryKeyProp, Check } from '@mikro-orm/core';
import { RoleOrmEntity } from './role';

@Entity({ tableName: 'role_inherit' })
@Check({ expression: 'parent_role_id <> child_role_id', name: 'chk_ri_diff' })
export class RoleInheritOrmEntity {
  [PrimaryKeyProp]?: ['parent', 'child'];

  @ManyToOne(() => RoleOrmEntity, { fieldName: 'parent_role_id', primary: true, deleteRule: 'cascade' })
  parent!: RoleOrmEntity;

  @ManyToOne(() => RoleOrmEntity, { fieldName: 'child_role_id', primary: true, deleteRule: 'cascade' })
  child!: RoleOrmEntity;
}
