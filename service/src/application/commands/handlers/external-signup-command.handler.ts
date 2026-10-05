import { AuditRecorder } from '@application/services/audit-recorder';
import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IdempotencyKeyHashPort } from '@application/ports/idempotency-key-hash.port';
import {
  ExternalSignupCommandPort,
  ExternalSignupError,
  ExternalSignupRepositoryPort,
  ExternalSignupStorePort,
  type ExternalSignupRequest,
  type ExternalSignupTicket,
} from '@application/ports/external-signup.port';

@Injectable()
export class ExternalSignupCommandHandler extends ExternalSignupCommandPort {
  constructor(
    private readonly store: ExternalSignupStorePort,
    private readonly repository: ExternalSignupRepositoryPort,
    private readonly keyHash: IdempotencyKeyHashPort,
    private readonly config: ConfigService,
    @Optional() private readonly audit?: AuditRecorder,
  ) {
    super();
  }
  async claim(
    tenantId: string,
    consumerClientId: string,
    request: ExternalSignupRequest,
  ) {
    const ticket = await this.store.claimTicket(
      tenantId,
      consumerClientId,
      request,
    );
    if (!ticket) throw new ExternalSignupError();
    return {
      ticketId: ticket.ticketId,
      provider: ticket.provider,
      providerSub: ticket.providerSub,
      clientId: ticket.clientId,
      issuer: this.issuer(ticket),
      expiresAt: ticket.expiresAt,
    };
  }
  async complete(
    tenantId: string,
    consumerClientId: string,
    request: ExternalSignupRequest,
    idempotencyKey: string,
  ) {
    const ticket = await this.store.getTicket(request.ticket);
    if (
      !ticket ||
      ticket.tenantId !== tenantId ||
      ticket.clientId !== request.clientId ||
      ticket.consumerClientId !== consumerClientId ||
      ticket.claimedAttemptId !== request.attemptId ||
      Date.parse(ticket.expiresAt) <= Date.now()
    )
      throw new ExternalSignupError();
    const keyHash = this.keyHash.hash(idempotencyKey);
    if (!(await this.store.bindCompletionKey(request.ticket, keyHash)))
      throw new ExternalSignupError('external_signup_conflict');
    const subject = await this.repository.complete({
      tenantId,
      consumerClientId,
      clientId: ticket.clientId,
      keyHash,
      provider: ticket.provider,
      providerSub: ticket.providerSub,
      profile: ticket.profile,
    });
    if (ticket.subject && ticket.subject !== subject)
      throw new ExternalSignupError('external_signup_conflict');
    await this.store.completeTicket(request.ticket, subject);
    await this.audit?.recordAdminAction({
      tenantId,
      category: 'SECURITY',
      action: 'CREATE',
      resourceType: 'external-signup-completion',
      resourceId: subject,
      metadata: {
        consumerClientId,
        clientId: ticket.clientId,
        provider: ticket.provider,
      },
    });
    return { issuer: this.issuer(ticket), subject };
  }
  private issuer(ticket: ExternalSignupTicket) {
    return `${this.config.get<string>('OIDC_ISSUER')}/t/${ticket.tenantCode}/oidc`;
  }
}
