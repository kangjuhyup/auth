import { Injectable } from '@nestjs/common';
import { ulid } from 'ulid';
import type { AuditContext } from '@application/dto';
import { IdempotencyKeyHashPort } from '@application/ports/idempotency-key-hash.port';
import { PasswordHashPort } from '@application/ports/password-hash.port';
import { AuditRecorder } from '@application/services/audit-recorder';
import { UserModel } from '@domain/models/user';
import { UserCredentialModel } from '@domain/models/user-credential';
import { ClientRepository } from '@domain/repositories';
import type { ProvisionUserCommand } from '../commands/provision-user.command';
import {
  UserProvisioningCommandPort,
  UserProvisioningError,
} from '../ports/user-provisioning-command.port';
import { UserWriteRepositoryPort } from '../ports/user-write-repository.port';

@Injectable()
export class UserProvisioningCommandHandler extends UserProvisioningCommandPort {
  constructor(
    private readonly users: UserWriteRepositoryPort,
    private readonly passwordHash: PasswordHashPort,
    private readonly keyHash: IdempotencyKeyHashPort,
    private readonly auditRecorder: AuditRecorder,
    private readonly clients: ClientRepository,
  ) {
    super();
  }

  async provision(
    tenantId: string,
    clientId: string,
    command: ProvisionUserCommand,
    auditContext?: AuditContext,
  ): Promise<{ subject: string }> {
    const auditClient = await this.clients.findByClientId(tenantId, clientId);
    if (!auditClient) throw new Error('Provisioning client unavailable');
    const provisioningKeyHash = this.keyHash.hash(command.idempotencyKey);
    const replay = await this.users.findByProvisioningKey(
      tenantId,
      clientId,
      provisioningKeyHash,
    );
    if (replay) return this.resolveReplay(replay, command.username);

    if (await this.users.findByUsername(tenantId, command.username)) {
      throw new UserProvisioningError('username_conflict');
    }

    const hashed = await this.passwordHash.hash(command.password);
    const subject = ulid();
    const user = UserModel.createProvisioned({
      id: subject,
      tenantId,
      username: command.username,
      provisionedByClientId: clientId,
      provisioningKeyHash,
      passwordCredential: UserCredentialModel.password({
        secretHash: hashed.hash,
        hashAlg: hashed.alg,
        hashParams: hashed.params,
        hashVersion: hashed.version,
        passwordChangeRequired: false,
      }),
    });

    try {
      await this.users.save(user);
    } catch (error) {
      const concurrent = await this.users.findByProvisioningKey(
        tenantId,
        clientId,
        provisioningKeyHash,
      );
      if (concurrent) return this.resolveReplay(concurrent, command.username);
      if (await this.users.findByUsername(tenantId, command.username)) {
        throw new UserProvisioningError('username_conflict');
      }
      throw error;
    }

    await this.auditRecorder.recordAdminAction({
      tenantId,
      clientId: auditClient.id,
      category: 'USER',
      action: 'CREATE',
      resourceType: 'provisioned-user',
      resourceId: subject,
      metadata: { authentication: 'client_credentials' },
      auditContext,
    });
    return { subject };
  }

  private resolveReplay(
    user: UserModel,
    username: string,
  ): { subject: string } {
    if (user.username !== username) {
      throw new UserProvisioningError('idempotency_conflict');
    }
    return { subject: user.id };
  }
}
