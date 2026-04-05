import { JwksKeyMapper } from '@infrastructure/repositories/mapper/jwks-key.mapper';
import { JwksKeyModel } from '@domain/models/jwks-key';
import { JwksKeyOrmEntity } from '@infrastructure/mikro-orm/entities';

describe('JwksKeyMapper', () => {
  describe('toDomain', () => {
    it('ORM 엔티티를 도메인 모델로 변환한다', () => {
      const entity = Object.assign(new JwksKeyOrmEntity(), {
        kid: 'kid-1',
        tenant: { id: 'tenant-1' },
        algorithm: 'RS256',
        publicKey: 'public-key',
        privateKeyEnc: 'private-key-enc',
        status: 'active',
        rotatedAt: null,
        expiresAt: null,
        createdAt: new Date('2025-01-01'),
      });

      const domain = JwksKeyMapper.toDomain(entity);

      expect(domain.kid).toBe('kid-1');
      expect(domain.tenantId).toBe('tenant-1');
      expect(domain.algorithm).toBe('RS256');
      expect(domain.publicKey).toBe('public-key');
      expect(domain.privateKeyEnc).toBe('private-key-enc');
      expect(domain.status).toBe('active');
      expect(domain.rotatedAt).toBeNull();
      expect(domain.expiresAt).toBeNull();
      expect(domain.createdAt).toEqual(new Date('2025-01-01'));
    });
  });

  describe('toOrm', () => {
    it('도메인 모델 값으로 기존 엔티티를 갱신한다', () => {
      const existing = Object.assign(new JwksKeyOrmEntity(), {
        kid: 'kid-1',
        algorithm: 'RS256',
        publicKey: 'old-public',
        privateKeyEnc: 'old-private',
        status: 'active',
        rotatedAt: null,
        expiresAt: null,
        createdAt: new Date('2025-01-01'),
      });
      const domain = new JwksKeyModel({
        kid: 'kid-1',
        tenantId: 'tenant-1',
        algorithm: 'ES256',
        publicKey: 'new-public',
        privateKeyEnc: 'new-private',
        status: 'rotated',
        rotatedAt: new Date('2025-01-03'),
        expiresAt: new Date('2025-01-04'),
        createdAt: new Date('2025-01-01'),
      });

      const entity = JwksKeyMapper.toOrm(domain, existing);

      expect(entity).toBe(existing);
      expect(entity.algorithm).toBe('ES256');
      expect(entity.publicKey).toBe('new-public');
      expect(entity.privateKeyEnc).toBe('new-private');
      expect(entity.status).toBe('rotated');
      expect(entity.rotatedAt).toEqual(new Date('2025-01-03'));
      expect(entity.expiresAt).toEqual(new Date('2025-01-04'));
    });
  });
});
