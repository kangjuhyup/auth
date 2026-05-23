import { PersistenceModel } from './persistence-model';
import type { IdpOauthEndpointsConfig } from './idp-oauth-endpoints';
import type { IdpProtocol, IdpSamlConfig } from './idp-saml-config';

export type { IdpOauthEndpointsConfig } from './idp-oauth-endpoints';
export type { IdpProtocol, IdpSamlConfig } from './idp-saml-config';

/**
 * IdP 식별자(slug). 내장 키(`google`, `kakao`, `naver`, `apple`)는 기본 OAuth 엔드포인트가 있고,
 * 그 외 값은 `oauthConfig`로 authorization/token/userinfo 등을 채워야 한다.
 */
export type IdpProvider = string;

interface IdentityProviderModelProps {
  tenantId: string;
  provider: IdpProvider;
  protocol?: IdpProtocol;
  displayName: string;
  clientId: string;
  clientSecret: string | null;
  redirectUri: string;
  enabled: boolean;
  oauthConfig: IdpOauthEndpointsConfig | null;
  samlConfig?: IdpSamlConfig | null;
}

export class IdentityProviderModel extends PersistenceModel<
  string,
  IdentityProviderModelProps
> {
  constructor(props: IdentityProviderModelProps, id?: string) {
    const normalized = {
      ...props,
      protocol: props.protocol ?? (props.samlConfig ? 'saml2' : 'oauth2'),
      samlConfig: props.samlConfig ?? null,
    };
    IdentityProviderModel.assertConfig(normalized);
    super(normalized, id);
  }

  get tenantId(): string {
    return this.etc.tenantId;
  }
  get provider(): IdpProvider {
    return this.etc.provider;
  }
  get protocol(): IdpProtocol {
    return this.etc.protocol ?? 'oauth2';
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
  get samlConfig(): IdpSamlConfig | null {
    return this.etc.samlConfig ?? null;
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
    const next = { ...this.etc, oauthConfig: v };
    IdentityProviderModel.assertConfig(next);
    this.etc.oauthConfig = v;
  }

  changeSamlConfig(v: IdpSamlConfig | null): void {
    const next = { ...this.etc, samlConfig: v };
    IdentityProviderModel.assertConfig(next);
    this.etc.samlConfig = v;
  }

  changeProtocol(v: IdpProtocol): void {
    const next = { ...this.etc, protocol: v };
    IdentityProviderModel.assertConfig(next);
    this.etc.protocol = v;
  }

  configureProtocol(params: {
    protocol: IdpProtocol;
    oauthConfig: IdpOauthEndpointsConfig | null;
    samlConfig: IdpSamlConfig | null;
  }): void {
    const next = {
      ...this.etc,
      protocol: params.protocol,
      oauthConfig: params.oauthConfig,
      samlConfig: params.samlConfig,
    };
    IdentityProviderModel.assertConfig(next);
    this.etc.protocol = params.protocol;
    this.etc.oauthConfig = params.oauthConfig;
    this.etc.samlConfig = params.samlConfig;
  }

  private static assertConfig(props: IdentityProviderModelProps): void {
    const protocol = props.protocol ?? 'oauth2';
    if (protocol === 'oauth2') {
      if (props.samlConfig) {
        throw new Error('OAuth2 identity provider cannot include samlConfig');
      }
      return;
    }

    if (!props.samlConfig) {
      throw new Error('SAML identity provider requires samlConfig');
    }
    if (props.oauthConfig) {
      throw new Error('SAML identity provider cannot include oauthConfig');
    }
    if (!props.samlConfig.entryPoint) {
      throw new Error('SAML identity provider requires entryPoint');
    }
    if (!props.samlConfig.idpCerts.length) {
      throw new Error(
        'SAML identity provider requires at least one IdP certificate',
      );
    }
  }
}
