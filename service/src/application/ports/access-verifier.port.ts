export type AuthenticatedUser = Readonly<{
  userId: string; // accountId/sub
  clientId?: string;
  scope?: string;
}>;

export abstract class AccessVerifierPort {
  abstract verify(tenantId: string, bearerToken: string): Promise<AuthenticatedUser>;
}
