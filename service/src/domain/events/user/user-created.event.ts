import { UserStatus } from '@infrastructure/mikro-orm/entities';
import { DomainEvent } from '../domain-event';
import { UserCredentialModel } from '@domain/models/user-credential';

export type UserCreatedPayload = Readonly<{
  tenantId: string;
  username: string;
  email?: string | null;
  emailVerified: boolean;
  phone?: string | null;
  phoneVerified: boolean;
  status: UserStatus;
  credential: UserCredentialModel;
}>;

export class UserCreatedEvent implements DomainEvent {
  readonly eventType = 'user.created';

  constructor(
    public readonly aggregateId: string, // userId
    public readonly occurredAt: Date,
    public readonly version: number,
    public readonly payload: UserCreatedPayload,
  ) {}
}
