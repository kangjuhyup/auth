import { CustomGrantModel } from '../models/custom-grant';

export interface CustomGrantListQuery {
  tenantId: string;
  page: number;
  limit: number;
}

export abstract class CustomGrantRepository {
  abstract findById(id: string): Promise<CustomGrantModel | null>;
  abstract findByGrantType(
    tenantId: string,
    grantType: string,
  ): Promise<CustomGrantModel | null>;
  abstract list(
    query: CustomGrantListQuery,
  ): Promise<{ items: CustomGrantModel[]; total: number }>;
  abstract listByTenantId(tenantId: string): Promise<CustomGrantModel[]>;
  abstract listEnabledByTenantId(tenantId: string): Promise<CustomGrantModel[]>;
  abstract save(customGrant: CustomGrantModel): Promise<CustomGrantModel>;
  abstract delete(id: string): Promise<void>;
}
