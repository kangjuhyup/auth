import { PersistenceModel } from './persistence-model';

export type IdpProvider = 'kakao' | 'naver' | 'google' | 'apple';

interface IdentityProviderModelProps {
  tenantId: string;
  provider: IdpProvider;
  displayName: string;
  clientId: string;
  clientSecret: string | null;
  redirectUri: string;
  enabled: boolean;
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
}
