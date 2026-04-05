import { UserMapper } from '@infrastructure/repositories/mapper/user.mapper';
import { UserOrmEntity, UserCredentialOrmEntity } from '@infrastructure/mikro-orm/entities';

function makeUserEntity(): UserOrmEntity {
  return Object.assign(new UserOrmEntity(), {
    id: 'user-1',
    tenant: { id: 'tenant-1' },
    username: 'alice',
    email: 'alice@example.com',
    emailVerified: true,
    phone: '01012345678',
    phoneVerified: false,
    status: 'ACTIVE',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-02'),
  });
}

function makeCredentialEntity(): UserCredentialOrmEntity {
  return Object.assign(new UserCredentialOrmEntity(), {
    id: 'cred-1',
    type: 'password',
    secretHash: 'hashed-password',
    hashAlg: 'argon2id',
    hashParams: { timeCost: 3 },
    hashVersion: 1,
    enabled: true,
    expiresAt: null,
  });
}

describe('UserMapper', () => {
  describe('toDomain', () => {
    it('활성 credential과 함께 유저 엔티티를 도메인 모델로 변환한다', () => {
      const domain = UserMapper.toDomain(makeUserEntity(), makeCredentialEntity());

      expect(domain.id).toBe('user-1');
      expect(domain.tenantId).toBe('tenant-1');
      expect(domain.username).toBe('alice');
      expect(domain.email).toBe('alice@example.com');
      expect(domain.emailVerified).toBe(true);
      expect(domain.phone).toBe('01012345678');
      expect(domain.phoneVerified).toBe(false);
      expect(domain.status).toBe('ACTIVE');
      expect(domain.passwordCredential?.secretHash).toBe('hashed-password');
      expect(domain.createdAt).toEqual(new Date('2025-01-01'));
      expect(domain.updatedAt).toEqual(new Date('2025-01-02'));
    });

    it('credential 없이도 유저 엔티티를 복원한다', () => {
      const domain = UserMapper.toDomain(makeUserEntity());

      expect(domain.passwordCredential).toBeUndefined();
    });
  });

  describe('credentialToDomain', () => {
    it('credential 엔티티를 도메인 모델로 변환한다', () => {
      const credential = UserMapper.credentialToDomain(makeCredentialEntity());

      expect(credential.type).toBe('password');
      expect(credential.secretHash).toBe('hashed-password');
      expect(credential.hashAlg).toBe('argon2id');
      expect(credential.hashParams).toEqual({ timeCost: 3 });
      expect(credential.hashVersion).toBe(1);
      expect(credential.enabled).toBe(true);
    });
  });
});
