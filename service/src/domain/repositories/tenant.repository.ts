import { TenantModel } from '../models/tenant';

export interface TenantListQuery {
  page: number;
  limit: number;
}

export abstract class TenantRepository {
  abstract findByCode(code: string): Promise<TenantModel | null>;
  abstract findById(id: string): Promise<TenantModel | null>;
  abstract list(query: TenantListQuery): Promise<{ items: TenantModel[]; total: number }>;
  abstract save(tenant: TenantModel): Promise<TenantModel>;
  abstract delete(id: string): Promise<void>;
}
