import { Entity, Index, PrimaryKey, Property, Unique } from '@mikro-orm/core';
import { ulid } from 'ulid';

export type OtpPurpose =
  | 'PASSWORD_RESET'
  | 'EMAIL_VERIFICATION'
  | 'PHONE_VERIFICATION'
  | 'MFA_LOGIN'
  | 'MAGIC_LINK';

@Entity({ tableName: 'otp_token' })
@Unique({ properties: ['requestId'], name: 'uk_otp_token_request_id' })
@Index({
  properties: ['tenantId', 'userId', 'purpose'],
  name: 'idx_otp_tenant_user_purpose',
})
@Index({ properties: ['expiresAt'], name: 'idx_otp_expires_at' })
export class OtpTokenOrmEntity {
  @PrimaryKey({ type: 'char', length: 26 })
  id: string = ulid();

  @Property({ fieldName: 'tenant_id', type: 'varchar', length: 64 })
  tenantId!: string;

  @Property({ fieldName: 'user_id', type: 'char', length: 26 })
  userId!: string;

  @Property({ type: 'varchar', length: 32 })
  purpose!: OtpPurpose;

  @Property({ fieldName: 'request_id', type: 'char', length: 26 })
  requestId!: string;

  @Property({ fieldName: 'token_hash', type: 'varchar', length: 128 })
  tokenHash!: string;

  @Property({ fieldName: 'issued_at', type: 'timestamptz' })
  issuedAt!: Date;

  @Property({ fieldName: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Property({ fieldName: 'consumed_at', type: 'timestamptz', nullable: true })
  consumedAt?: Date;

  @Property({
    fieldName: 'created_at',
    type: 'timestamptz',
    onCreate: () => new Date(),
  })
  createdAt: Date = new Date();
}
