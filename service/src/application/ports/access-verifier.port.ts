export const ACCESS_VERIFIER_PORT = Symbol('ACCESS_VERIFIER_PORT');

export type AuthenticatedUser = Readonly<{
  userId: string; // accountId/sub
  clientId?: string;
  scope?: string;
}>;

export interface AccessVerifierPort {
  verify(tenantId: string, bearerToken: string): Promise<AuthenticatedUser>;
}
