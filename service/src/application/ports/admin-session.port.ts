import type { LoginAttemptBlockReason } from './login-attempt-policy.port';

export type AdminSessionView = {
  userId: string;
  username: string;
  passwordChangeRequired: boolean;
};

export type AdminSessionIssueResult =
  | { token: string; username: string; passwordChangeRequired: boolean }
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
  ): Promise<AdminSessionView | null>;

  abstract changePassword(
    token: string,
    dto: { currentPassword: string; newPassword: string },
  ): Promise<void>;
}
