import { Entity, ManyToOne, PrimaryKeyProp } from '@mikro-orm/core';
import { UserOrmEntity } from './user';
import { GroupOrmEntity } from './group';

@Entity({ tableName: 'user_group' })
export class UserGroupOrmEntity {
  [PrimaryKeyProp]?: ['user', 'group'];

  @ManyToOne(() => UserOrmEntity, { fieldName: 'user_id', primary: true, deleteRule: 'cascade' })
  user!: UserOrmEntity;

  @ManyToOne(() => GroupOrmEntity, { fieldName: 'group_id', primary: true, deleteRule: 'cascade' })
  group!: GroupOrmEntity;
}
