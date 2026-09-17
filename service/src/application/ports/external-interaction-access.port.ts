export type ExternalInteractionAccessClaims = Readonly<{
  accessId: string;
  tenantId: string;
  tenantCode: string;
  clientId: string;
  uid: string;
  origin: string;
  expiresAt: Date;
}>;

export type IssuedExternalInteractionAccess = Readonly<{
  accessToken: string;
  csrfToken: string;
  browserBinding: string;
  claims: ExternalInteractionAccessClaims;
}>;

export abstract class ExternalInteractionAccessPort {
  abstract issue(params: {
    tenantId: string;
    tenantCode: string;
    clientId: string;
    uid: string;
    origin: string;
  }): Promise<IssuedExternalInteractionAccess>;

  abstract verify(params: {
    accessToken: string;
    csrfToken: string;
    browserBinding: string;
    tenantId: string;
    tenantCode: string;
    clientId: string;
    uid: string;
    origin: string;
  }): Promise<ExternalInteractionAccessClaims | null>;

  abstract consume(params: {
    tenantCode: string;
    uid: string;
    accessId: string;
  }): Promise<boolean>;
}
