import { Entity, ManyToOne, PrimaryKeyProp, Ref } from '@mikro-orm/core';
import { UserOrmEntity } from './user';
import { GroupOrmEntity } from './group';

@Entity({ tableName: 'user_group' })
export class UserGroupOrmEntity {
  [PrimaryKeyProp]?: ['user', 'group'];

  @ManyToOne(() => UserOrmEntity, { fieldName: 'user_id', primary: true, deleteRule: 'cascade', ref: true })
  user!: Ref<UserOrmEntity>;

  @ManyToOne(() => GroupOrmEntity, { fieldName: 'group_id', primary: true, deleteRule: 'cascade', ref: true })
  group!: Ref<GroupOrmEntity>;
}
