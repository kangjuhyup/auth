import { IdentityProviderModel } from '../models/identity-provider';

export abstract class IdentityProviderRepository {
  abstract findByTenantAndProvider(
    tenantId: string,
    provider: string,
  ): Promise<IdentityProviderModel | null>;

  abstract listEnabledByTenant(
    tenantId: string,
  ): Promise<IdentityProviderModel[]>;
}
