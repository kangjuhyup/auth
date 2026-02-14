import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Index,
} from '@mikro-orm/core';
import { TenantOrmEntity } from './tenant';
import { UserOrmEntity } from './user';
import { ClientOrmEntity } from './client';

export type EventCategory =
  | 'AUTH'
  | 'USER'
  | 'ROLE'
  | 'GROUP'
  | 'PERMISSION'
  | 'SECURITY'
  | 'SYSTEM'
  | 'OTHER';

export type EventSeverity = 'INFO' | 'WARN' | 'ERROR';

export type EventAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'TOKEN_ISSUED'
  | 'TOKEN_REVOKED'
  | 'ACCESS_DENIED'
  | 'LINK_IDP'
  | 'UNLINK_IDP'
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'ASSIGN'
  | 'REVOKE'
  | 'CONFIG_CHANGE'
  | 'OTHER';

@Entity({ tableName: 'event' })
@Index({ properties: ['tenant', 'occurredAt'], name: 'idx_event_tenant_time' })
@Index({
  properties: ['category', 'occurredAt'],
  name: 'idx_event_category_time',
})
@Index({ properties: ['user', 'occurredAt'], name: 'idx_event_user_time' })
@Index({ properties: ['client', 'occurredAt'], name: 'idx_event_client_time' })
@Index({ properties: ['action', 'occurredAt'], name: 'idx_event_action_time' })
export class EventOrmEntity {
  @PrimaryKey({ type: 'bigint', autoincrement: true })
  id!: string;

  @ManyToOne(() => TenantOrmEntity, {
    fieldName: 'tenant_id',
    deleteRule: 'cascade',
  })
  tenant!: TenantOrmEntity;

  @ManyToOne(() => UserOrmEntity, {
    fieldName: 'user_id',
    nullable: true,
    deleteRule: 'set null',
  })
  user?: UserOrmEntity | null;

  @ManyToOne(() => ClientOrmEntity, {
    fieldName: 'client_id',
    nullable: true,
    deleteRule: 'set null',
  })
  client?: ClientOrmEntity | null;

  @Property({ type: 'varchar', length: 20 })
  category!: EventCategory;

  @Property({ type: 'varchar', length: 20 })
  severity!: EventSeverity;

  @Property({ type: 'varchar', length: 20 })
  action!: EventAction;

  @Property({
    fieldName: 'resource_type',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  resourceType?: string | null;

  @Property({
    fieldName: 'resource_id',
    type: 'varchar',
    length: 191,
    nullable: true,
  })
  resourceId?: string | null;

  @Property({ type: 'boolean', default: true })
  success!: boolean;

  @Property({ type: 'varchar', length: 255, nullable: true })
  reason?: string | null;

  @Property({ type: 'blob', nullable: true })
  ip?: Buffer | null;

  @Property({
    fieldName: 'user_agent',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  userAgent?: string | null;

  @Property({ type: 'json', nullable: true })
  metadata?: Record<string, unknown> | null;

  @Property({ fieldName: 'occurred_at', defaultRaw: 'CURRENT_TIMESTAMP' })
  occurredAt: Date = new Date();
}
