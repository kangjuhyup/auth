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

  get tenantId(): string {
    return this.props.tenantId;
  }

  get userId(): string | null | undefined {
    return this.props.userId;
  }

  get clientId(): string | null | undefined {
    return this.props.clientId;
  }

  get category(): EventCategory {
    return this.props.category;
  }

  get severity(): EventSeverity {
    return this.props.severity;
  }

  get action(): EventAction {
    return this.props.action;
  }

  get resourceType(): string | null | undefined {
    return this.props.resourceType;
  }

  get resourceId(): string | null | undefined {
    return this.props.resourceId;
  }

  get success(): boolean {
    return this.props.success;
  }

  get reason(): string | null | undefined {
    return this.props.reason;
  }

  get ip(): Buffer | null | undefined {
    return this.props.ip;
  }

  get userAgent(): string | null | undefined {
    return this.props.userAgent;
  }

  get metadata(): Record<string, unknown> | null | undefined {
    return this.props.metadata;
  }

  get occurredAt(): Date {
    return this.props.occurredAt;
  }

  setId(id: string): void {
    this._id = id;
  }
}
