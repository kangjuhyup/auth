import { Entity, PrimaryKey, Property, ManyToOne, Index, Ref } from '@mikro-orm/core';
import { TenantOrmEntity } from './tenant';

export type KeyStatus = 'active' | 'rotated' | 'revoked';

@Entity({ tableName: 'jwks_key' })
@Index({ properties: ['tenant', 'status'], name: 'idx_jwks_tenant_status' })
export class JwksKeyOrmEntity {
  @PrimaryKey({ type: 'varchar', length: 64 })
  kid!: string;

  @ManyToOne(() => TenantOrmEntity, {
    fieldName: 'tenant_id',
    deleteRule: 'restrict',
    ref: true,
  })
  tenant!: Ref<TenantOrmEntity>;

  @Property({ type: 'varchar', length: 16 })
  algorithm!: string;

  @Property({ fieldName: 'public_key', type: 'text' })
  publicKey!: string;

  @Property({ fieldName: 'private_key_enc', type: 'text' })
  privateKeyEnc!: string;

  @Property({ type: 'varchar', length: 16, default: 'active' })
  status!: KeyStatus;

  @Property({ fieldName: 'rotated_at', nullable: true })
  rotatedAt?: Date | null;

  @Property({ fieldName: 'expires_at', nullable: true })
  expiresAt?: Date | null;

  @Property({ fieldName: 'created_at', onCreate: () => new Date() })
  createdAt: Date = new Date();
}
