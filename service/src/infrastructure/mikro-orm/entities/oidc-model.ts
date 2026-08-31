import { Entity, PrimaryKey, Property, Index } from '@mikro-orm/core';

@Entity({ tableName: 'oidc_model' })
@Index({
  properties: ['tenantId', 'kind', 'uid'],
  name: 'idx_oidc_model_tenant_kind_uid',
})
@Index({
  properties: ['tenantId', 'kind', 'grantId'],
  name: 'idx_oidc_model_tenant_kind_grant',
})
@Index({
  properties: ['tenantId', 'kind', 'userCode'],
  name: 'idx_oidc_model_tenant_kind_usercode',
})
export class OidcModelOrmEntity {
  @PrimaryKey({ fieldName: 'tenant_id', type: 'varchar', length: 64 })
  tenantId!: string;

  @PrimaryKey({ type: 'varchar', length: 64 })
  kind!: string;

  @PrimaryKey({ type: 'varchar', length: 128 })
  id!: string;

  @Property({ type: 'json' })
  payload!: Record<string, unknown>;

  @Property({ type: 'varchar', length: 128, nullable: true })
  uid?: string | null;

  @Property({
    fieldName: 'grant_id',
    type: 'varchar',
    length: 128,
    nullable: true,
  })
  grantId?: string | null;

  @Property({
    fieldName: 'user_code',
    type: 'varchar',
    length: 128,
    nullable: true,
  })
  userCode?: string | null;

  @Property({ fieldName: 'consumed_at', nullable: true })
  consumedAt?: Date | null;

  @Property({ fieldName: 'expires_at', nullable: true })
  expiresAt?: Date | null;

  @Property({ fieldName: 'created_at', onCreate: () => new Date() })
  createdAt: Date = new Date();
}
