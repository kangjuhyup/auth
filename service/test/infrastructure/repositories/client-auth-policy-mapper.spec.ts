import { ClientAuthPolicyMapper } from '@infrastructure/repositories/mapper/client-auth-policy.mapper';
import { ClientAuthPolicyModel } from '@domain/models/client-auth-policy';
import { ClientAuthPolicyOrmEntity } from '@infrastructure/mikro-orm/entities';

function makeOrmEntity(): ClientAuthPolicyOrmEntity {
  return Object.assign(new ClientAuthPolicyOrmEntity(), {
    id: '1',
    tenant: { id: 'tenant-1' },
    client: { id: 'client-1' },
    allowedAuthMethods: ['password', 'totp'],
    defaultAcr: 'urn:auth:pwd',
    mfaRequired: false,
    allowedMfaMethods: ['totp'],
    maxSessionDurationSec: 3600,
    consentRequired: true,
    requireAuthTime: false,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-02'),
  });
}

function makeDomainModel(id?: string): ClientAuthPolicyModel {
  const m = new ClientAuthPolicyModel(
    {
      tenantId: 'tenant-1',
      clientRefId: 'client-1',
      allowedAuthMethods: ['password', 'totp'],
      defaultAcr: 'urn:auth:pwd',
      mfaRequired: false,
      allowedMfaMethods: ['totp'],
      maxSessionDurationSec: 3600,
      consentRequired: true,
      requireAuthTime: false,
    },
    id,
  );
  if (id) m.setPersistence(id, new Date('2025-01-01'), new Date('2025-01-02'));
  return m;
}

describe('ClientAuthPolicyMapper', () => {
  describe('toDomain', () => {
    it('ORM 엔티티를 도메인 모델로 변환한다', () => {
      const entity = makeOrmEntity();
      const domain = ClientAuthPolicyMapper.toDomain(entity);

      expect(domain.id).toBe('1');
      expect(domain.tenantId).toBe('tenant-1');
      expect(domain.clientRefId).toBe('client-1');
      expect(domain.allowedAuthMethods).toEqual(['password', 'totp']);
      expect(domain.defaultAcr).toBe('urn:auth:pwd');
      expect(domain.mfaRequired).toBe(false);
      expect(domain.allowedMfaMethods).toEqual(['totp']);
      expect(domain.maxSessionDurationSec).toBe(3600);
      expect(domain.consentRequired).toBe(true);
      expect(domain.requireAuthTime).toBe(false);
    });

    it('maxSessionDurationSec가 null이면 null로 매핑한다', () => {
      const entity = makeOrmEntity();
      entity.maxSessionDurationSec = null;

      const domain = ClientAuthPolicyMapper.toDomain(entity);

      expect(domain.maxSessionDurationSec).toBeNull();
    });

    it('setPersistence가 호출되어 createdAt/updatedAt이 설정된다', () => {
      const entity = makeOrmEntity();
      const domain = ClientAuthPolicyMapper.toDomain(entity);

      expect(domain.createdAt).toEqual(new Date('2025-01-01'));
      expect(domain.updatedAt).toEqual(new Date('2025-01-02'));
    });
  });

  describe('toOrm', () => {
    it('도메인 모델을 새 ORM 엔티티로 변환한다', () => {
      const domain = makeDomainModel('1');
      const entity = ClientAuthPolicyMapper.toOrm(domain);

      expect(entity.id).toBe('1');
      expect(entity.allowedAuthMethods).toEqual(['password', 'totp']);
      expect(entity.defaultAcr).toBe('urn:auth:pwd');
      expect(entity.mfaRequired).toBe(false);
      expect(entity.allowedMfaMethods).toEqual(['totp']);
      expect(entity.maxSessionDurationSec).toBe(3600);
      expect(entity.consentRequired).toBe(true);
      expect(entity.requireAuthTime).toBe(false);
    });

    it('기존 엔티티가 있으면 해당 엔티티를 업데이트한다', () => {
      const existing = makeOrmEntity();
      existing.allowedAuthMethods = ['password'];
      existing.mfaRequired = true;

      const domain = makeDomainModel('1');
      const entity = ClientAuthPolicyMapper.toOrm(domain, existing);

      expect(entity).toBe(existing);
      expect(entity.allowedAuthMethods).toEqual(['password', 'totp']);
      expect(entity.mfaRequired).toBe(false);
    });

    it('id가 없는 도메인 모델은 id를 설정하지 않는다', () => {
      const domain = makeDomainModel();
      const entity = ClientAuthPolicyMapper.toOrm(domain);

      expect(entity.id).toBeUndefined();
    });

    it('모든 변경 가능 필드가 업데이트된다', () => {
      const existing = makeOrmEntity();

      const domain = new ClientAuthPolicyModel(
        {
          tenantId: 'tenant-1',
          clientRefId: 'client-1',
          allowedAuthMethods: ['webauthn', 'magic_link'],
          defaultAcr: 'urn:auth:mfa',
          mfaRequired: true,
          allowedMfaMethods: ['webauthn', 'recovery_code'],
          maxSessionDurationSec: null,
          consentRequired: false,
          requireAuthTime: true,
        },
        '1',
      );
      domain.setPersistence('1', new Date(), new Date());

      const entity = ClientAuthPolicyMapper.toOrm(domain, existing);

      expect(entity.allowedAuthMethods).toEqual(['webauthn', 'magic_link']);
      expect(entity.defaultAcr).toBe('urn:auth:mfa');
      expect(entity.mfaRequired).toBe(true);
      expect(entity.allowedMfaMethods).toEqual(['webauthn', 'recovery_code']);
      expect(entity.maxSessionDurationSec).toBeNull();
      expect(entity.consentRequired).toBe(false);
      expect(entity.requireAuthTime).toBe(true);
    });
  });
});
