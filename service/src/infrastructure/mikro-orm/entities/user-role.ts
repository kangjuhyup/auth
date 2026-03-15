import { Entity, ManyToOne, PrimaryKeyProp, Unique, Ref } from '@mikro-orm/core';
import { UserOrmEntity } from './user';
import { RoleOrmEntity } from './role';
import { ClientOrmEntity } from './client';

@Entity({ tableName: 'user_role' })
@Unique({ properties: ['user', 'role', 'client'], name: 'uk_user_role_user_role_client' })
export class UserRoleOrmEntity {
  [PrimaryKeyProp]?: ['user', 'role'];

  @ManyToOne(() => UserOrmEntity, { fieldName: 'user_id', primary: true, deleteRule: 'cascade', ref: true })
  user!: Ref<UserOrmEntity>;

  @ManyToOne(() => RoleOrmEntity, { fieldName: 'role_id', primary: true, deleteRule: 'cascade', ref: true })
  role!: Ref<RoleOrmEntity>;

  @ManyToOne(() => ClientOrmEntity, { fieldName: 'client_id', nullable: true, deleteRule: 'cascade', ref: true })
  client?: Ref<ClientOrmEntity> | null;
}
