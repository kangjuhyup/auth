import type { LoginAttemptBlockReason } from './login-attempt-policy.port';

export type AdminSessionIssueResult =
  | { token: string; username: string }
  | {
      blocked: true;
      reason: LoginAttemptBlockReason;
      retryAfterSec: number;
    }
  | null;

export abstract class AdminSessionPort {
  abstract issueAdminToken(params: {
    username: string;
    password: string;
    ipAddress?: string;
    userAgent?: string;
    correlationId?: string;
  }): Promise<AdminSessionIssueResult>;

  abstract verifyAdminToken(token: string): Promise<boolean>;

  abstract getAdminSession(
    token: string,
  ): Promise<{ userId: string; username: string } | null>;
}
