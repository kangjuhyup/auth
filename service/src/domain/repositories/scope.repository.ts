import { ScopeModel } from '../models/scope';

export interface ScopeListQuery {
  tenantId: string;
  page: number;
  limit: number;
}

export abstract class ScopeRepository {
  abstract findById(id: string): Promise<ScopeModel | null>;
  abstract findByName(
    tenantId: string,
    name: string,
  ): Promise<ScopeModel | null>;
  abstract findByNames(
    tenantId: string,
    names: string[],
  ): Promise<ScopeModel[]>;
  abstract list(
    query: ScopeListQuery,
  ): Promise<{ items: ScopeModel[]; total: number }>;
  abstract listEnabledByTenantId(tenantId: string): Promise<ScopeModel[]>;
  abstract save(scope: ScopeModel): Promise<ScopeModel>;
  abstract delete(id: string): Promise<void>;
}
