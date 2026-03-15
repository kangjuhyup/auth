import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Index,
  Ref,
} from '@mikro-orm/core';
import { BaseEntity } from '../base';
import { UserOrmEntity } from './user';

export type CredentialType = 'password' | 'totp' | 'webauthn' | 'recovery_code';

@Entity({ tableName: 'user_credential' })
@Index({ properties: ['user', 'type'], name: 'idx_ucred_user_type' })
export class UserCredentialOrmEntity extends BaseEntity {
  @PrimaryKey({ type: 'bigint', autoincrement: true })
  id!: string;

  @ManyToOne(() => UserOrmEntity, {
    fieldName: 'user_id',
    deleteRule: 'cascade',
    ref: true,
  })
  user!: Ref<UserOrmEntity>;

  @Property({ type: 'varchar', length: 20 })
  type!: CredentialType;

  @Property({ fieldName: 'secret_hash', type: 'varchar', length: 255 })
  secretHash!: string;

  @Property({
    fieldName: 'hash_alg',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  hashAlg?: string;

  @Property({ fieldName: 'hash_params', type: 'json', nullable: true })
  hashParams?: Record<string, unknown>;

  @Property({ fieldName: 'hash_version', type: 'int', nullable: true })
  hashVersion?: number;

  @Property({ type: 'boolean', default: true })
  enabled!: boolean;

  @Property({ fieldName: 'expires_at', nullable: true })
  expiresAt?: Date;
}
