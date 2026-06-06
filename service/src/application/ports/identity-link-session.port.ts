export type IdentityLinkSession = Readonly<{
  state: string;
  tenantId: string;
  tenantCode: string;
  userId: string;
  provider: string;
  redirectUri: string;
  returnTo?: string | null;
  createdAt: string;
}>;

export abstract class IdentityLinkSessionPort {
  abstract create(session: IdentityLinkSession, ttlSec: number): Promise<void>;

  abstract consume(state: string): Promise<IdentityLinkSession | null>;
}
