import { TenantModel } from '../models/tenant';

export const TENANT_REPOSITORY = Symbol('TENANT_REPOSITORY');

export interface TenantRepository {
  findByCode(code: string): Promise<TenantModel | null>;
  findById(id: string): Promise<TenantModel | null>;
}
