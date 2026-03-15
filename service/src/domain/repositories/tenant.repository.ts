import { TenantModel } from '../models/tenant';

export abstract class TenantRepository {
  abstract findByCode(code: string): Promise<TenantModel | null>;
  abstract findById(id: string): Promise<TenantModel | null>;
}
