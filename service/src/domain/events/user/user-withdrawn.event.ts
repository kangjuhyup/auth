import type { DomainEvent } from '@domain/events';

export type UserWithdrawnPayload = Readonly<{
  tenantId: string;
  withdrawnAt: Date;
}>;

export class UserWithdrawnEvent implements DomainEvent {
  readonly eventType = 'user.withdrawn';

  constructor(
    public readonly aggregateId: string,
    public readonly occurredAt: Date,
    public readonly version: number,
    public readonly payload: UserWithdrawnPayload,
  ) {}
}
