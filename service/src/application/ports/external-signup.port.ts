export type ExternalOAuthState = {
  tenantId: string;
  tenantCode: string;
  clientId: string;
  uid: string;
  provider: string;
  redirectUri: string;
  intent: 'login' | 'signup';
  browserHash: string;
  callbackHash?: string;
};
export type ExternalAuthenticatedIdentity = ExternalOAuthState & {
  providerSub: string;
  profile: Record<string, unknown>;
};
export type ExternalSignupTicket = ExternalAuthenticatedIdentity & {
  ticketId: string;
  ticket: string;
  expiresAt: string;
  attemptId: string;
  consumerClientId?: string;
  claimedAttemptId?: string;
  subject?: string;
  completionKeyHash?: string;
};
export type ExternalSignupRequest = {
  ticket: string;
  clientId: string;
  attemptId: string;
};
export class ExternalSignupError extends Error {
  constructor(readonly code: string = 'external_signup_invalid') {
    super(code);
  }
}
// Ephemeral OAuth protocol records, not a best-effort business cache.
export abstract class ExternalSignupStorePort {
  abstract putState(state: string, value: ExternalOAuthState): Promise<void>;
  abstract consumeState(state: string): Promise<ExternalOAuthState | null>;
  abstract putIdentity(value: ExternalAuthenticatedIdentity): Promise<void>;
  abstract consumeIdentity(
    tenantId: string,
    uid: string,
  ): Promise<ExternalAuthenticatedIdentity | null>;
  abstract issueTicket(
    value: ExternalAuthenticatedIdentity,
  ): Promise<ExternalSignupTicket>;
  abstract getInteractionTicket(
    tenantId: string,
    uid: string,
  ): Promise<ExternalSignupTicket | null>;
  abstract getTicket(ticket: string): Promise<ExternalSignupTicket | null>;
  abstract claimTicket(
    tenantId: string,
    consumerClientId: string,
    request: ExternalSignupRequest,
  ): Promise<ExternalSignupTicket | null>;
  abstract bindCompletionKey(ticket: string, keyHash: string): Promise<boolean>;
  abstract completeTicket(ticket: string, subject: string): Promise<void>;
}
export abstract class ExternalSignupRepositoryPort {
  abstract complete(params: {
    tenantId: string;
    consumerClientId: string;
    clientId: string;
    keyHash: string;
    provider: string;
    providerSub: string;
    profile: Record<string, unknown>;
  }): Promise<string>;
}
export abstract class ExternalSignupCommandPort {
  abstract claim(
    tenantId: string,
    consumerClientId: string,
    request: ExternalSignupRequest,
  ): Promise<{
    ticketId: string;
    provider: string;
    providerSub: string;
    clientId: string;
    issuer: string;
    expiresAt: string;
  }>;
  abstract complete(
    tenantId: string,
    consumerClientId: string,
    request: ExternalSignupRequest,
    idempotencyKey: string,
  ): Promise<{ issuer: string; subject: string }>;
}
