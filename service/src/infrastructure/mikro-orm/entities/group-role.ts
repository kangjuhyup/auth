import { Entity, ManyToOne, PrimaryKeyProp, Unique, Ref } from '@mikro-orm/core';
import { GroupOrmEntity } from './group';
import { RoleOrmEntity } from './role';
import { ClientOrmEntity } from './client';

@Entity({ tableName: 'group_role' })
@Unique({ properties: ['group', 'role', 'client'], name: 'uk_group_role_group_role_client' })
export class GroupRoleOrmEntity {
  [PrimaryKeyProp]?: ['group', 'role'];

  @ManyToOne(() => GroupOrmEntity, { fieldName: 'grp_id', primary: true, deleteRule: 'cascade', ref: true })
  group!: Ref<GroupOrmEntity>;

  @ManyToOne(() => RoleOrmEntity, { fieldName: 'role_id', primary: true, deleteRule: 'cascade', ref: true })
  role!: Ref<RoleOrmEntity>;

  @ManyToOne(() => ClientOrmEntity, { fieldName: 'client_id', nullable: true, deleteRule: 'cascade', ref: true })
  client?: Ref<ClientOrmEntity> | null;
}
