import type { IdpOauthEndpointsConfig } from '@domain/models/identity-provider';

export interface IdpUserInfo {
  sub: string;
  email?: string;
  profile?: Record<string, unknown>;
}

export abstract class IdpPort {
  abstract getAuthorizationUrl(
    provider: string,
    oauthConfig: IdpOauthEndpointsConfig | null,
    clientId: string,
    redirectUri: string,
    state: string,
    scopes?: string[],
  ): string;

  abstract exchangeCode(
    provider: string,
    oauthConfig: IdpOauthEndpointsConfig | null,
    clientId: string,
    clientSecret: string | null,
    code: string,
    redirectUri: string,
  ): Promise<IdpUserInfo>;
}
