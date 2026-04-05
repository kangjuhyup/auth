import { IdentityProviderModel } from '../models/identity-provider';

export interface IdentityProviderListQuery {
  tenantId: string;
  page: number;
  limit: number;
}

export abstract class IdentityProviderRepository {
  abstract findByTenantAndProvider(
    tenantId: string,
    provider: string,
  ): Promise<IdentityProviderModel | null>;

  abstract listEnabledByTenant(
    tenantId: string,
  ): Promise<IdentityProviderModel[]>;

  abstract listByTenant(
    query: IdentityProviderListQuery,
  ): Promise<{ items: IdentityProviderModel[]; total: number }>;

  abstract findByIdForTenant(
    tenantId: string,
    id: string,
  ): Promise<IdentityProviderModel | null>;

  abstract save(model: IdentityProviderModel): Promise<IdentityProviderModel>;

  abstract delete(id: string): Promise<void>;
}
