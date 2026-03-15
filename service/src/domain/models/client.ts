import { PersistenceModel } from './persistence-model';

export type ClientType = 'confidential' | 'public' | 'service';

interface ClientModelProps {
  tenantId: string;
  clientId: string;
  name: string;
  type: ClientType;
  enabled: boolean;
  redirectUris: string[];
  grantTypes: string[];
  responseTypes: string[];
  tokenEndpointAuthMethod: string;
  scope: string;
  postLogoutRedirectUris: string[];
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

  changeName(name: string): void {
    this.etc.name = name;
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
}
