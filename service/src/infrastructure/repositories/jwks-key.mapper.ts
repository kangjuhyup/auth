import { JwksKeyModel, KeyAlgorithm } from '@domain/models/jwks-key';
import { JwksKeyOrmEntity } from '../mikro-orm/entities/jwks-key';

export class JwksKeyMapper {
  static toDomain(entity: JwksKeyOrmEntity): JwksKeyModel {
    return new JwksKeyModel({
      kid: entity.kid,
      tenantId: entity.tenant.id,
      algorithm: entity.algorithm as KeyAlgorithm,
      publicKey: entity.publicKey,
      privateKeyEnc: entity.privateKeyEnc,
      status: entity.status,
      rotatedAt: entity.rotatedAt ?? null,
      expiresAt: entity.expiresAt ?? null,
      createdAt: entity.createdAt,
    });
  }

  static toOrm(domain: JwksKeyModel, existing: JwksKeyOrmEntity): JwksKeyOrmEntity {
    existing.algorithm = domain.algorithm;
    existing.publicKey = domain.publicKey;
    existing.privateKeyEnc = domain.privateKeyEnc;
    existing.status = domain.status;
    existing.rotatedAt = domain.rotatedAt ?? null;
    existing.expiresAt = domain.expiresAt ?? null;
    return existing;
  }
}
