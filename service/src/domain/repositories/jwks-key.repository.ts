import { JwksKeyModel } from '../models/jwks-key';

export abstract class JwksKeyRepository {
  abstract findActiveByTenantId(tenantId: string): Promise<JwksKeyModel[]>;
  abstract save(key: JwksKeyModel): Promise<void>;
  abstract saveMany(keys: JwksKeyModel[]): Promise<void>;
}
