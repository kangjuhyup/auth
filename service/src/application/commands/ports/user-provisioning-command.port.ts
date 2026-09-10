import type { AuditContext } from '@application/dto';
import type { ProvisionUserCommand } from '../commands/provision-user.command';

export type UserProvisioningErrorCode =
  | 'username_conflict'
  | 'idempotency_conflict';

export class UserProvisioningError extends Error {
  constructor(public readonly code: UserProvisioningErrorCode) {
    super(`UserProvisioning:${code}`);
    this.name = 'UserProvisioningError';
  }
}

export abstract class UserProvisioningCommandPort {
  abstract provision(
    tenantId: string,
    clientId: string,
    command: ProvisionUserCommand,
    auditContext?: AuditContext,
  ): Promise<{ subject: string }>;
}
