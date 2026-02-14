import { Entity, ManyToOne, PrimaryKeyProp, Unique } from '@mikro-orm/core';
import { UserOrmEntity } from './user';
import { RoleOrmEntity } from './role';
import { ClientOrmEntity } from './client';

@Entity({ tableName: 'user_role' })
@Unique({ properties: ['user', 'role', 'client'], name: 'uk_user_role_user_role_client' })
export class UserRoleOrmEntity {
  [PrimaryKeyProp]?: ['user', 'role'];

  @ManyToOne(() => UserOrmEntity, { fieldName: 'user_id', primary: true, deleteRule: 'cascade' })
  user!: UserOrmEntity;

  @ManyToOne(() => RoleOrmEntity, { fieldName: 'role_id', primary: true, deleteRule: 'cascade' })
  role!: RoleOrmEntity;

  @ManyToOne(() => ClientOrmEntity, { fieldName: 'client_id', nullable: true, deleteRule: 'cascade' })
  client?: ClientOrmEntity | null;
}
