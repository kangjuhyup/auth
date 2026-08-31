import { Entity, Index, PrimaryKey, Property } from '@mikro-orm/core';

@Entity({ tableName: 'oidc_session_index' })
@Index({
  properties: ['tenantId', 'clientId', 'accountId', 'expiresAt'],
  name: 'idx_oidc_session_idx_lookup',
})
@Index({
  properties: ['tenantId', 'grantId'],
  name: 'idx_oidc_session_idx_grant',
})
export class OidcSessionIndexOrmEntity {
  @PrimaryKey({ fieldName: 'tenant_id', type: 'varchar', length: 64 })
  tenantId!: string;

  @PrimaryKey({ fieldName: 'session_id', type: 'varchar', length: 128 })
  sessionId!: string;

  @PrimaryKey({ fieldName: 'client_id', type: 'varchar', length: 128 })
  clientId!: string;

  @Property({ fieldName: 'account_id', type: 'varchar', length: 128 })
  accountId!: string;

  @Property({
    fieldName: 'grant_id',
    type: 'varchar',
    length: 128,
    nullable: true,
  })
  grantId?: string | null;

  @Property({ fieldName: 'expires_at', nullable: true })
  expiresAt?: Date | null;

  @Property({ fieldName: 'created_at', onCreate: () => new Date() })
  createdAt: Date = new Date();
}
