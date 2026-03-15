import { Entity, ManyToOne, PrimaryKeyProp, Check, Ref } from '@mikro-orm/core';
import type { RoleOrmEntity } from './role';

@Entity({ tableName: 'role_inherit' })
@Check({ expression: 'parent_role_id <> child_role_id', name: 'chk_ri_diff' })
export class RoleInheritOrmEntity {
  [PrimaryKeyProp]?: ['parent', 'child'];

  @ManyToOne(() => 'RoleOrmEntity', {
    fieldName: 'parent_role_id',
    primary: true,
    deleteRule: 'cascade',
    ref: true,
  })
  parent!: Ref<RoleOrmEntity>;

  @ManyToOne(() => 'RoleOrmEntity', {
    fieldName: 'child_role_id',
    primary: true,
    deleteRule: 'cascade',
    ref: true,
  })
  child!: Ref<RoleOrmEntity>;
}
