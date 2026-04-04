import { UserQueryHandler } from '@application/queries/handlers/user-query.handler';
import type { UserWriteRepositoryPort } from '@application/commands/ports/user-write-repository.port';
import type { PasswordHashPort, HashPolicy } from '@application/ports/password-hash.port';
import type { MfaStrategy } from '@application/queries/strategies';
import { UserModel } from '@domain/models/user';
import { UserCredentialModel } from '@domain/models/user-credential';

function makeUser(overrides: Partial<Parameters<typeof UserModel.of>[0]> = {}): UserModel {
  return UserModel.of({
    id: 'user-1',
    tenantId: 'tenant-1',
    username: 'testuser',
    email: 'user@example.com',
    emailVerified: true,
    phone: null,
    phoneVerified: false,
    status: 'ACTIVE',
    passwordCredential: UserCredentialModel.password({
      secretHash: 'hashed-pw',
      hashAlg: 'argon2id',
    }),
    ...overrides,
  });
}

function createMockUserRepo(): jest.Mocked<UserWriteRepositoryPort> {
  return {
    findById: jest.fn().mockResolvedValue(makeUser()),
    findByUsername: jest.fn().mockResolvedValue(makeUser()),
    findByContact: jest.fn().mockResolvedValue(null),
    list: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    save: jest.fn().mockResolvedValue(undefined),
    findCredentialsByType: jest.fn().mockResolvedValue([]),
    saveCredential: jest.fn().mockResolvedValue(undefined),
  };
}

function createMockPasswordHash(): jest.Mocked<PasswordHashPort> {
  return {
    defaultPolicy: jest.fn().mockReturnValue({ alg: 'argon2id' } as HashPolicy),
    hash: jest.fn(),
    verify: jest.fn().mockResolvedValue(true),
  };
}

describe('UserQueryHandler', () => {
  let handler: UserQueryHandler;
  let userRepo: jest.Mocked<UserWriteRepositoryPort>;
  let passwordHash: jest.Mocked<PasswordHashPort>;
  let totpStrategy: jest.Mocked<MfaStrategy>;

  beforeEach(() => {
    jest.clearAllMocks();
    userRepo = createMockUserRepo();
    passwordHash = createMockPasswordHash();
    totpStrategy = { method: 'totp', verify: jest.fn().mockResolvedValue(true) };
    handler = new UserQueryHandler(userRepo, passwordHash, [totpStrategy]);
  });

  describe('findProfile', () => {
    it('user 없음 → null', async () => {
      userRepo.findById.mockResolvedValue(undefined);

      expect(await handler.findProfile({ tenantId: 'tenant-1', userId: 'user-1' })).toBeNull();
    });

    it('tenant 불일치 → null', async () => {
      userRepo.findById.mockResolvedValue(makeUser({ tenantId: 'other' }));

      expect(await handler.findProfile({ tenantId: 'tenant-1', userId: 'user-1' })).toBeNull();
    });

    it('성공 → UserProfileView 필드 매핑', async () => {
      const result = await handler.findProfile({ tenantId: 'tenant-1', userId: 'user-1' });

      expect(result).toMatchObject({
        userId: 'user-1',
        tenantId: 'tenant-1',
        username: 'testuser',
        email: 'user@example.com',
        emailVerified: true,
        status: 'ACTIVE',
      });
    });
  });

  describe('findClaimsBySub', () => {
    it('user 없음 → null', async () => {
      userRepo.findById.mockResolvedValue(undefined);

      expect(await handler.findClaimsBySub({ tenantId: 'tenant-1', sub: 'user-1' })).toBeNull();
    });

    it('tenant 불일치 → null', async () => {
      userRepo.findById.mockResolvedValue(makeUser({ tenantId: 'other' }));

      expect(await handler.findClaimsBySub({ tenantId: 'tenant-1', sub: 'user-1' })).toBeNull();
    });

    it('성공 → sub/email/email_verified 매핑', async () => {
      const result = await handler.findClaimsBySub({ tenantId: 'tenant-1', sub: 'user-1' });

      expect(result).toEqual({ sub: 'user-1', email: 'user@example.com', email_verified: true });
    });
  });

  describe('findByUsername', () => {
    it('user 없음 → null', async () => {
      userRepo.findByUsername.mockResolvedValue(undefined);

      expect(await handler.findByUsername({ tenantId: 'tenant-1', username: 'testuser' })).toBeNull();
    });

    it('성공 → UserProfileView 반환', async () => {
      const result = await handler.findByUsername({ tenantId: 'tenant-1', username: 'testuser' });

      expect(result?.username).toBe('testuser');
    });
  });

  describe('authenticate', () => {
    it('user 없음 → null', async () => {
      userRepo.findByUsername.mockResolvedValue(undefined);

      expect(await handler.authenticate({ tenantId: 'tenant-1', username: 'u', password: 'pw' })).toBeNull();
    });

    it('ACTIVE 아닌 상태 → null', async () => {
      userRepo.findByUsername.mockResolvedValue(makeUser({ status: 'LOCKED' }));

      expect(await handler.authenticate({ tenantId: 'tenant-1', username: 'u', password: 'pw' })).toBeNull();
    });

    it('password credential 없음 → null', async () => {
      userRepo.findByUsername.mockResolvedValue(makeUser({ passwordCredential: undefined }));

      expect(await handler.authenticate({ tenantId: 'tenant-1', username: 'u', password: 'pw' })).toBeNull();
    });

    it('비밀번호 불일치 → null', async () => {
      passwordHash.verify.mockResolvedValue(false);

      expect(await handler.authenticate({ tenantId: 'tenant-1', username: 'u', password: 'wrong' })).toBeNull();
    });

    it('성공 → { userId } 반환', async () => {
      const result = await handler.authenticate({ tenantId: 'tenant-1', username: 'u', password: 'correct' });

      expect(result).toEqual({ userId: 'user-1' });
    });
  });

  describe('getMfaMethods', () => {
    it('user 없음 → []', async () => {
      userRepo.findById.mockResolvedValue(undefined);

      expect(await handler.getMfaMethods('tenant-1', 'user-1')).toEqual([]);
    });

    it('tenant 불일치 → []', async () => {
      userRepo.findById.mockResolvedValue(makeUser({ tenantId: 'other' }));

      expect(await handler.getMfaMethods('tenant-1', 'user-1')).toEqual([]);
    });

    it('중복된 credential type은 한 번만 반환', async () => {
      userRepo.findCredentialsByType.mockResolvedValue([
        UserCredentialModel.of({ type: 'totp', secretHash: 's1', hashAlg: 'sha1', enabled: true }),
        UserCredentialModel.of({ type: 'totp', secretHash: 's2', hashAlg: 'sha1', enabled: true }),
        UserCredentialModel.of({ type: 'webauthn', secretHash: 's3', hashAlg: 'ES256', enabled: true }),
      ]);

      const result = await handler.getMfaMethods('tenant-1', 'user-1');

      expect(result).toHaveLength(2);
      expect(result).toContain('totp');
      expect(result).toContain('webauthn');
    });
  });

  describe('verifyMfa', () => {
    it('user 없음 → false', async () => {
      userRepo.findById.mockResolvedValue(undefined);

      expect(await handler.verifyMfa({ tenantId: 'tenant-1', userId: 'user-1', method: 'totp', code: '123' })).toBe(false);
    });

    it('tenant 불일치 → false', async () => {
      userRepo.findById.mockResolvedValue(makeUser({ tenantId: 'other' }));

      expect(await handler.verifyMfa({ tenantId: 'tenant-1', userId: 'user-1', method: 'totp', code: '123' })).toBe(false);
    });

    it('등록되지 않은 strategy → false', async () => {
      expect(await handler.verifyMfa({ tenantId: 'tenant-1', userId: 'user-1', method: 'webauthn' })).toBe(false);
    });

    it('strategy.verify 결과를 그대로 반환', async () => {
      totpStrategy.verify.mockResolvedValue(true);

      const result = await handler.verifyMfa({ tenantId: 'tenant-1', userId: 'user-1', method: 'totp', code: '123456' });

      expect(totpStrategy.verify).toHaveBeenCalledTimes(1);
      expect(result).toBe(true);
    });
  });
});
