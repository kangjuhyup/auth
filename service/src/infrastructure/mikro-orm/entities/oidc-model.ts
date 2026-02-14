import { Entity, PrimaryKey, Property, Index } from '@mikro-orm/core';

@Entity({ tableName: 'oidc_model' })
@Index({ properties: ['kind', 'uid'], name: 'idx_oidc_model_kind_uid' })
@Index({ properties: ['kind', 'grantId'], name: 'idx_oidc_model_kind_grant' })
@Index({ properties: ['kind', 'userCode'], name: 'idx_oidc_model_kind_usercode' })
export class OidcModelOrmEntity {
  @PrimaryKey({ type: 'varchar', length: 128 })
  id!: string;

  @Property({ type: 'varchar', length: 64 })
  kind!: string;

  @Property({ type: 'json' })
  payload!: Record<string, unknown>;

  @Property({ type: 'varchar', length: 128, nullable: true })
  uid?: string | null;

  @Property({ fieldName: 'grant_id', type: 'varchar', length: 128, nullable: true })
  grantId?: string | null;

  @Property({ fieldName: 'user_code', type: 'varchar', length: 128, nullable: true })
  userCode?: string | null;

  @Property({ fieldName: 'consumed_at', nullable: true })
  consumedAt?: Date | null;

  @Property({ fieldName: 'expires_at', nullable: true })
  expiresAt?: Date | null;

  @Property({ fieldName: 'created_at', onCreate: () => new Date() })
  createdAt: Date = new Date();
}
