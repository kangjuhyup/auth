import type Provider from 'oidc-provider';

export class OidcProviderRegistry {
  private readonly providers = new Map<string, Promise<Provider>>();

  constructor(
    private readonly create: (tenantCode: string) => Promise<Provider>,
  ) {}

  get(tenantCode: string): Promise<Provider> {
    let provider = this.providers.get(tenantCode);

    if (!provider) {
      provider = this.create(tenantCode).catch((error) => {
        this.providers.delete(tenantCode);
        throw error;
      });
      this.providers.set(tenantCode, provider);
    }

    return provider;
  }
}
