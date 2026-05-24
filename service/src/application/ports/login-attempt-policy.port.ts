export type LoginAttemptScope = 'admin' | 'interaction';

export type LoginAttemptBlockReason = 'rate_limited' | 'temporarily_locked';

export type LoginAttemptDecision = Readonly<
  | { allowed: true }
  | {
      allowed: false;
      reason: LoginAttemptBlockReason;
      retryAfterSec: number;
    }
>;

export type LoginAttemptFailureResult = Readonly<{
  failureCount: number;
  temporarilyLocked: boolean;
  retryAfterSec?: number;
}>;

export type LoginAttemptParams = Readonly<{
  tenantId: string;
  username: string;
  ipAddress?: string;
  scope: LoginAttemptScope;
}>;

export abstract class LoginAttemptPolicyPort {
  abstract consumeAttempt(
    params: LoginAttemptParams,
  ): Promise<LoginAttemptDecision>;

  abstract recordFailure(
    params: LoginAttemptParams,
  ): Promise<LoginAttemptFailureResult>;

  abstract recordSuccess(params: LoginAttemptParams): Promise<void>;
}
