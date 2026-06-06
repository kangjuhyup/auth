import { Getter } from '../decorators';

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

export interface EventModelProps {
  tenantId: string;
  userId?: string | null;
  clientId?: string | null;
  category: EventCategory;
  severity: EventSeverity;
  action: EventAction;
  resourceType?: string | null;
  resourceId?: string | null;
  success: boolean;
  reason?: string | null;
  ip?: Buffer | null;
  userAgent?: string | null;
  correlationId?: string | null;
  metadata?: Record<string, unknown> | null;
  occurredAt: Date;
}

export class EventModel {
  private props: EventModelProps;
  private _id?: string;

  constructor(props: EventModelProps, id?: string) {
    this.props = { ...props };
    this._id = id;
  }

  get id(): string | undefined {
    return this._id;
  }

  @Getter()
  declare readonly tenantId: string;

  @Getter()
  declare readonly userId: string | null | undefined;

  @Getter()
  declare readonly clientId: string | null | undefined;

  @Getter()
  declare readonly category: EventCategory;

  @Getter()
  declare readonly severity: EventSeverity;

  @Getter()
  declare readonly action: EventAction;

  @Getter()
  declare readonly resourceType: string | null | undefined;

  @Getter()
  declare readonly resourceId: string | null | undefined;

  @Getter()
  declare readonly success: boolean;

  @Getter()
  declare readonly reason: string | null | undefined;

  @Getter()
  declare readonly ip: Buffer | null | undefined;

  @Getter()
  declare readonly userAgent: string | null | undefined;

  @Getter()
  declare readonly correlationId: string | null | undefined;

  @Getter()
  declare readonly metadata: Record<string, unknown> | null | undefined;

  @Getter()
  declare readonly occurredAt: Date;

  setId(id: string): void {
    this._id = id;
  }
}
