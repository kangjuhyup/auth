import { TenantConfigModel } from '../models/tenant-config';

export abstract class TenantConfigRepository {
  abstract findByTenantId(tenantId: string): Promise<TenantConfigModel | null>;
  abstract save(config: TenantConfigModel): Promise<TenantConfigModel>;
}
