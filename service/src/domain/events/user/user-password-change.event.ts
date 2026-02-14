import type { DomainEvent } from '@domain/events';
import type { UserCredentialModel } from '@domain/models/user-credential';

export type UserPasswordChangedPayload = Readonly<{
  tenantId: string;
  changedAt: Date;
  credential: UserCredentialModel; // 새 password credential(해시 포함)
}>;

export class UserPasswordChangedEvent implements DomainEvent {
  readonly eventType = 'user.password_changed';

  constructor(
    public readonly aggregateId: string,
    public readonly occurredAt: Date,
    public readonly version: number,
    public readonly payload: UserPasswordChangedPayload,
  ) {}
}
