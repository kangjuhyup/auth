import Provider from 'oidc-provider';

export class OidcProviderRegistry {
  private readonly providers = new Map<string, Provider>();

  constructor(private readonly create: (tenantCode: string) => Provider) {}

  get(tenantCode: string): Provider {
    let provider = this.providers.get(tenantCode);

    if (!provider) {
      provider = this.create(tenantCode);
      this.providers.set(tenantCode, provider);
    }

    return provider;
  }
}
