export interface IdpUserInfo {
  sub: string;
  email?: string;
  profile?: Record<string, unknown>;
}

export abstract class IdpPort {
  abstract getAuthorizationUrl(
    provider: string,
    clientId: string,
    redirectUri: string,
    state: string,
    scopes?: string[],
  ): string;

  abstract exchangeCode(
    provider: string,
    clientId: string,
    clientSecret: string | null,
    code: string,
    redirectUri: string,
  ): Promise<IdpUserInfo>;
}
