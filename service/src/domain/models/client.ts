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

  get tenantId(): string {
    return this.etc.tenantId;
  }

  get clientId(): string {
    return this.etc.clientId;
  }

  get secretEnc(): string | null | undefined {
    return this.etc.secretEnc;
  }

  get name(): string {
    return this.etc.name;
  }

  get type(): ClientType {
    return this.etc.type;
  }

  get enabled(): boolean {
    return this.etc.enabled;
  }

  get redirectUris(): string[] {
    return this.etc.redirectUris;
  }

  get grantTypes(): string[] {
    return this.etc.grantTypes;
  }

  get responseTypes(): string[] {
    return this.etc.responseTypes;
  }

  get tokenEndpointAuthMethod(): string {
    return this.etc.tokenEndpointAuthMethod;
  }

  get scope(): string {
    return this.etc.scope;
  }

  get postLogoutRedirectUris(): string[] {
    return this.etc.postLogoutRedirectUris;
  }

  get applicationType(): ApplicationType {
    return this.etc.applicationType;
  }

  get backchannelLogoutUri(): string | null | undefined {
    return this.etc.backchannelLogoutUri;
  }

  get frontchannelLogoutUri(): string | null | undefined {
    return this.etc.frontchannelLogoutUri;
  }

  get accessTokenTtlSec(): number | null | undefined {
    return this.etc.accessTokenTtlSec;
  }

  get refreshTokenTtlSec(): number | null | undefined {
    return this.etc.refreshTokenTtlSec;
  }

  get allowedResources(): string[] {
    return this.etc.allowedResources;
  }

  get skipConsent(): boolean {
    return this.etc.skipConsent;
  }

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
