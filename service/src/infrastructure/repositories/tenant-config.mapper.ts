import { TenantConfigModel } from '@domain/models/tenant-config';
import { TenantConfigOrmEntity } from '../mikro-orm/entities/tenant-config';

export class TenantConfigMapper {
  static toDomain(entity: TenantConfigOrmEntity): TenantConfigModel {
    return new TenantConfigModel({
      tenantId: entity.tenant.id,
      signupPolicy: entity.signupPolicy,
      requirePhoneVerify: entity.requirePhoneVerify,
      brandName: entity.brandName ?? null,
      extra: entity.extra ?? null,
    });
  }

  static toOrm(
    domain: TenantConfigModel,
    existing: TenantConfigOrmEntity,
  ): TenantConfigOrmEntity {
    existing.signupPolicy = domain.signupPolicy;
    existing.requirePhoneVerify = domain.requirePhoneVerify;
    existing.brandName = domain.brandName ?? null;
    existing.extra = domain.extra ?? null;
    return existing;
  }
}
