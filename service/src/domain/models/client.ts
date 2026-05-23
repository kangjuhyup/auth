import { Getter } from '../decorators';
import { PersistenceModel } from './persistence-model';

export type ClientType = 'confidential' | 'public' | 'service';
export type ApplicationType = 'web' | 'native';

interface ClientModelProps {
  tenantId: string;
  clientId: string;
  secretEnc?: string | null;
  name: string;
  type: ClientType;
  enabled: boolean;
  redirectUris: string[];
  grantTypes: string[];
  responseTypes: string[];
  tokenEndpointAuthMethod: string;
  scope: string;
  postLogoutRedirectUris: string[];
  applicationType: ApplicationType;
  backchannelLogoutUri?: string | null;
  frontchannelLogoutUri?: string | null;
  accessTokenTtlSec?: number | null;
  refreshTokenTtlSec?: number | null;
  allowedResources: string[];
  skipConsent: boolean;
}

export class ClientModel extends PersistenceModel<string, ClientModelProps> {
  constructor(props: ClientModelProps, id?: string) {
    super(props, id);
  }

  @Getter()
  declare readonly tenantId: string;

  @Getter()
  declare readonly clientId: string;

  @Getter()
  declare readonly secretEnc: string | null | undefined;

  @Getter()
  declare readonly name: string;

  @Getter()
  declare readonly type: ClientType;

  @Getter()
  declare readonly enabled: boolean;

  @Getter()
  declare readonly redirectUris: string[];

  @Getter()
  declare readonly grantTypes: string[];

  @Getter()
  declare readonly responseTypes: string[];

  @Getter()
  declare readonly tokenEndpointAuthMethod: string;

  @Getter()
  declare readonly scope: string;

  @Getter()
  declare readonly postLogoutRedirectUris: string[];

  @Getter()
  declare readonly applicationType: ApplicationType;

  @Getter()
  declare readonly backchannelLogoutUri: string | null | undefined;

  @Getter()
  declare readonly frontchannelLogoutUri: string | null | undefined;

  @Getter()
  declare readonly accessTokenTtlSec: number | null | undefined;

  @Getter()
  declare readonly refreshTokenTtlSec: number | null | undefined;

  @Getter()
  declare readonly allowedResources: string[];

  @Getter()
  declare readonly skipConsent: boolean;

  setSkipConsent(value: boolean): void {
    this.etc.skipConsent = value;
  }

  changeName(name: string): void {
    this.etc.name = name;
  }

  changeSecretEnc(secretEnc: string | null): void {
    this.etc.secretEnc = secretEnc;
  }

  setEnabled(enabled: boolean): void {
    this.etc.enabled = enabled;
  }

  changeRedirectUris(uris: string[]): void {
    this.etc.redirectUris = uris;
  }

  changeGrantTypes(types: string[]): void {
    this.etc.grantTypes = types;
  }

  changeResponseTypes(types: string[]): void {
    this.etc.responseTypes = types;
  }

  changeTokenEndpointAuthMethod(method: string): void {
    this.etc.tokenEndpointAuthMethod = method;
  }

  changeScope(scope: string): void {
    this.etc.scope = scope;
  }

  changePostLogoutRedirectUris(uris: string[]): void {
    this.etc.postLogoutRedirectUris = uris;
  }

  changeApplicationType(type: ApplicationType): void {
    this.etc.applicationType = type;
  }

  changeBackchannelLogoutUri(uri: string | null): void {
    this.etc.backchannelLogoutUri = uri;
  }

  changeFrontchannelLogoutUri(uri: string | null): void {
    this.etc.frontchannelLogoutUri = uri;
  }

  changeAllowedResources(resources: string[]): void {
    this.etc.allowedResources = resources;
  }

  changeAccessTokenTtlSec(sec: number | null): void {
    this.etc.accessTokenTtlSec = sec;
  }

  changeRefreshTokenTtlSec(sec: number | null): void {
    this.etc.refreshTokenTtlSec = sec;
  }
}
