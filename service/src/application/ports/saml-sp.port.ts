import type { IdpSamlConfig } from '@domain/models/identity-provider';
import type { IdpUserInfo } from './idp.port';

export interface SamlServiceProviderContext {
  tenantId: string;
  provider: string;
  issuer: string;
  callbackUrl: string;
}

export interface SamlLoginRequest extends SamlServiceProviderContext {
  config: IdpSamlConfig;
  relayState: string;
}

export interface SamlResponseRequest extends SamlServiceProviderContext {
  config: IdpSamlConfig;
  relayState: string | undefined;
  samlResponse: string | undefined;
}

export abstract class SamlSpPort {
  abstract getLoginUrl(params: SamlLoginRequest): Promise<string>;

  abstract validatePostResponse(
    params: SamlResponseRequest,
  ): Promise<IdpUserInfo>;

  abstract generateMetadata(
    params: SamlServiceProviderContext & { config: IdpSamlConfig },
  ): string;
}
