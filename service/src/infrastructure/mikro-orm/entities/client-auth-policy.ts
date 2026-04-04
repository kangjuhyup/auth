import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Unique,
  Ref,
} from '@mikro-orm/core';
import { BaseEntity } from '../base';
import { TenantOrmEntity } from './tenant';
import { ClientOrmEntity } from './client';

@Entity({ tableName: 'client_auth_policy' })
@Unique({ properties: ['client'], name: 'uk_client_auth_policy_client' })
export class ClientAuthPolicyOrmEntity extends BaseEntity {
  @PrimaryKey({ type: 'bigint', autoincrement: true })
  id!: string;

  @ManyToOne(() => TenantOrmEntity, {
    fieldName: 'tenant_id',
    deleteRule: 'restrict',
    ref: true,
  })
  tenant!: Ref<TenantOrmEntity>;

  @ManyToOne(() => ClientOrmEntity, {
    fieldName: 'client_id',
    deleteRule: 'cascade',
    ref: true,
  })
  client!: Ref<ClientOrmEntity>;

  @Property({
    fieldName: 'allowed_auth_methods',
    type: 'json',
    default: '["password"]',
  })
  allowedAuthMethods!: string[];

  @Property({
    fieldName: 'default_acr',
    type: 'varchar',
    length: 128,
    default: 'urn:auth:pwd',
  })
  defaultAcr!: string;

  @Property({ fieldName: 'mfa_required', type: 'boolean', default: false })
  mfaRequired!: boolean;

  @Property({
    fieldName: 'allowed_mfa_methods',
    type: 'json',
    default: '["totp"]',
  })
  allowedMfaMethods!: string[];

  @Property({
    fieldName: 'max_session_duration_sec',
    type: 'int',
    nullable: true,
  })
  maxSessionDurationSec?: number | null;

  @Property({
    fieldName: 'consent_required',
    type: 'boolean',
    default: true,
  })
  consentRequired!: boolean;

  @Property({
    fieldName: 'require_auth_time',
    type: 'boolean',
    default: false,
  })
  requireAuthTime!: boolean;
}
