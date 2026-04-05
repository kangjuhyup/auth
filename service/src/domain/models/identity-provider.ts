import { PersistenceModel } from './persistence-model';
import type { IdpOauthEndpointsConfig } from './idp-oauth-endpoints';

export type { IdpOauthEndpointsConfig } from './idp-oauth-endpoints';

export type IdpProvider = 'kakao' | 'naver' | 'google' | 'apple';

interface IdentityProviderModelProps {
  tenantId: string;
  provider: IdpProvider;
  displayName: string;
  clientId: string;
  clientSecret: string | null;
  redirectUri: string;
  enabled: boolean;
  oauthConfig: IdpOauthEndpointsConfig | null;
}

export class IdentityProviderModel extends PersistenceModel<
  string,
  IdentityProviderModelProps
> {
  constructor(props: IdentityProviderModelProps, id?: string) {
    super(props, id);
  }

  get tenantId(): string {
    return this.etc.tenantId;
  }
  get provider(): IdpProvider {
    return this.etc.provider;
  }
  get displayName(): string {
    return this.etc.displayName;
  }
  get clientId(): string {
    return this.etc.clientId;
  }
  get clientSecret(): string | null {
    return this.etc.clientSecret;
  }
  get redirectUri(): string {
    return this.etc.redirectUri;
  }
  get enabled(): boolean {
    return this.etc.enabled;
  }
  get oauthConfig(): IdpOauthEndpointsConfig | null {
    return this.etc.oauthConfig;
  }

  changeDisplayName(v: string): void {
    this.etc.displayName = v;
  }

  changeClientId(v: string): void {
    this.etc.clientId = v;
  }

  changeClientSecret(v: string | null): void {
    this.etc.clientSecret = v;
  }

  changeRedirectUri(v: string): void {
    this.etc.redirectUri = v;
  }

  setEnabled(v: boolean): void {
    this.etc.enabled = v;
  }

  changeOauthConfig(v: IdpOauthEndpointsConfig | null): void {
    this.etc.oauthConfig = v;
  }
}
