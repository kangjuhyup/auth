export type UserSessionView = Readonly<{
  sessionId: string;
  tenantId: string;
  userId: string;
  clientId: string;
  createdAt: Date;
  expiresAt: Date | null;
}>;

export abstract class UserSessionPort {
  abstract listUserSessions(params: {
    tenantId: string;
    userId: string;
  }): Promise<UserSessionView[]>;

  abstract revokeUserSession(params: {
    tenantId: string;
    userId: string;
    sessionId: string;
  }): Promise<number>;

  abstract revokeUserSessions(params: {
    tenantId: string;
    userId: string;
  }): Promise<number>;
}
