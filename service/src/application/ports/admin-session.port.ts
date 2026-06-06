import type { LoginAttemptBlockReason } from './login-attempt-policy.port';

export type AdminSessionView = {
  userId: string;
  username: string;
  passwordChangeRequired: boolean;
};

export type AdminSessionTokenBundle = {
  accessToken: string;
  refreshToken: string;
};

export type AdminSessionAuthSuccess = AdminSessionTokenBundle & {
  username: string;
  passwordChangeRequired: boolean;
};

export type AdminSessionIssueResult =
  | AdminSessionAuthSuccess
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

  abstract refreshAdminSession(
    refreshToken: string,
  ): Promise<AdminSessionAuthSuccess | null>;

  abstract verifyAdminToken(token: string): Promise<boolean>;

  abstract getAdminSession(token: string): Promise<AdminSessionView | null>;

  abstract changePassword(
    token: string,
    dto: { currentPassword: string; newPassword: string },
  ): Promise<void>;
}
