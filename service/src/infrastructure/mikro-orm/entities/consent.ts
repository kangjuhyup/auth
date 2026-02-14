import { Entity, PrimaryKey, Property, ManyToOne, Unique } from '@mikro-orm/core';
import { TenantOrmEntity } from './tenant';
import { UserOrmEntity } from './user';
import { ClientOrmEntity } from './client';

@Entity({ tableName: 'consent' })
@Unique({
  properties: ['tenant', 'user', 'client'],
  name: 'uk_consent_tenant_user_client',
})
export class ConsentOrmEntity {
  @PrimaryKey({ type: 'bigint', autoincrement: true })
  id!: string;

  @ManyToOne(() => TenantOrmEntity, {
    fieldName: 'tenant_id',
    deleteRule: 'cascade',
  })
  tenant!: TenantOrmEntity;

  @ManyToOne(() => UserOrmEntity, {
    fieldName: 'user_id',
    deleteRule: 'cascade',
  })
  user!: UserOrmEntity;

  @ManyToOne(() => ClientOrmEntity, {
    fieldName: 'client_id',
    deleteRule: 'cascade',
  })
  client!: ClientOrmEntity;

  @Property({ fieldName: 'granted_scopes', type: 'varchar', length: 512 })
  grantedScopes!: string;

  @Property({ fieldName: 'granted_at' })
  grantedAt: Date = new Date();

  @Property({ fieldName: 'revoked_at', nullable: true })
  revokedAt?: Date | null;
}
