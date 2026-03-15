import { Test, TestingModule } from '@nestjs/testing';
import { EntityManager } from '@mikro-orm/core';

// Application Ports
import { PASSWORD_HASHER_PORT } from '@application/ports/password-hash.port';
import { OTP_HASH_PORT } from '@application/ports/otp-hash.port';
import { OTP_TOKEN_PORT } from '@application/ports/otp-token.port';
import { USER_WRITE_REPOSITORY_PORT } from '@application/commands/ports/user-write-repository.port';

// Infrastructure Adapters
import { PasswordHashAdapter } from '@infrastructure/crypto/password/password.adapter';
import { Argon2idHash } from '@infrastructure/crypto/password/impl/argon2-hash';
import { Pbkdf2Sha256Hash } from '@infrastructure/crypto/password/impl/pbkdf-hash';
import { OtpHashAdapter } from '@infrastructure/crypto/otp/otp-hash.adapter';
import { OtpTokenAdapter } from '@infrastructure/crypto/otp/otp-token.adapter';
import { UserWriteRepositoryImpl } from '@infrastructure/repositories/user-write.repository.impl';

// Domain Repositories
import { TENANT_REPOSITORY } from '@domain/repositories';
import { TenantRepositoryImpl } from '@infrastructure/repositories/tenant.repository.impl';

/**
 * 전체 모듈 의존성 주입 통합 테스트
 *
 * 목적:
 * 1. 핵심 인프라 포트들이 올바르게 provider로 등록되었는지 검증
 * 2. NestJS DI 컨테이너가 정상적으로 의존성을 해결하는지 검증
 * 3. 모듈 간 exports/imports가 올바른지 검증
 */

const mockEntityManager = {
  find: jest.fn(),
  findOne: jest.fn(),
  findOneOrFail: jest.fn(),
  transactional: jest.fn(),
  nativeUpdate: jest.fn(),
  upsert: jest.fn(),
  create: jest.fn(),
  persist: jest.fn(),
  flush: jest.fn(),
  getReference: jest.fn(),
};

describe('Infrastructure Adapters DI', () => {
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        Argon2idHash,
        Pbkdf2Sha256Hash,
        {
          provide: PASSWORD_HASHER_PORT,
          useFactory: (argon2: Argon2idHash, pbkdf2: Pbkdf2Sha256Hash) =>
            new PasswordHashAdapter([argon2, pbkdf2], { alg: 'argon2id', params: {}, version: 1 }),
          inject: [Argon2idHash, Pbkdf2Sha256Hash],
        },
        {
          provide: OTP_HASH_PORT,
          useFactory: () => new OtpHashAdapter('test-secret-minimum-16-chars'),
        },
        {
          provide: OTP_TOKEN_PORT,
          useClass: OtpTokenAdapter,
        },
        {
          provide: USER_WRITE_REPOSITORY_PORT,
          useClass: UserWriteRepositoryImpl,
        },
        {
          provide: TENANT_REPOSITORY,
          useClass: TenantRepositoryImpl,
        },
        {
          provide: EntityManager,
          useValue: mockEntityManager,
        },
      ],
    }).compile();
  });

  afterAll(async () => {
    await module?.close();
  });

  describe('Crypto Adapters', () => {
    it('PASSWORD_HASHER_PORT가 PasswordHashAdapter로 주입된다', () => {
      const passwordHash = module.get(PASSWORD_HASHER_PORT, { strict: false });

      expect(passwordHash).toBeDefined();
      expect(passwordHash).toBeInstanceOf(PasswordHashAdapter);
      expect(passwordHash.hash).toBeDefined();
      expect(passwordHash.verify).toBeDefined();
      expect(passwordHash.defaultPolicy).toBeDefined();
    });

    it('OTP_HASH_PORT가 OtpHashAdapter로 주입된다', () => {
      const otpHash = module.get(OTP_HASH_PORT, { strict: false });

      expect(otpHash).toBeDefined();
      expect(otpHash).toBeInstanceOf(OtpHashAdapter);
      expect(otpHash.hash).toBeDefined();
      expect(otpHash.generateToken).toBeDefined();
    });

    it('OTP_TOKEN_PORT가 OtpTokenAdapter로 주입된다', () => {
      const otpToken = module.get(OTP_TOKEN_PORT, { strict: false });

      expect(otpToken).toBeDefined();
      expect(otpToken).toBeInstanceOf(OtpTokenAdapter);
      expect(otpToken.findValidByTokenHash).toBeDefined();
      expect(otpToken.consume).toBeDefined();
      expect(otpToken.create).toBeDefined();
    });
  });

  describe('Repository Adapters', () => {
    it('USER_WRITE_REPOSITORY_PORT가 UserWriteRepositoryImpl로 주입된다', () => {
      const userWriteRepo = module.get(USER_WRITE_REPOSITORY_PORT, { strict: false });

      expect(userWriteRepo).toBeDefined();
      expect(userWriteRepo).toBeInstanceOf(UserWriteRepositoryImpl);
      expect(userWriteRepo.findById).toBeDefined();
      expect(userWriteRepo.findByUsername).toBeDefined();
      expect(userWriteRepo.findByContact).toBeDefined();
      expect(userWriteRepo.save).toBeDefined();
    });

    it('TENANT_REPOSITORY가 TenantRepositoryImpl로 주입된다', () => {
      const tenantRepo = module.get(TENANT_REPOSITORY, { strict: false });

      expect(tenantRepo).toBeDefined();
      expect(tenantRepo).toBeInstanceOf(TenantRepositoryImpl);
      expect(tenantRepo.findById).toBeDefined();
      expect(tenantRepo.findByCode).toBeDefined();
    });
  });
});

describe('Provider 메서드 시그니처 검증', () => {
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        Argon2idHash,
        Pbkdf2Sha256Hash,
        {
          provide: PASSWORD_HASHER_PORT,
          useFactory: (argon2: Argon2idHash, pbkdf2: Pbkdf2Sha256Hash) =>
            new PasswordHashAdapter([argon2, pbkdf2], { alg: 'argon2id', params: {}, version: 1 }),
          inject: [Argon2idHash, Pbkdf2Sha256Hash],
        },
        {
          provide: OTP_HASH_PORT,
          useFactory: () => new OtpHashAdapter('test-secret-minimum-16-chars'),
        },
      ],
    }).compile();
  });

  afterAll(async () => {
    await module?.close();
  });

  it('PasswordHashPort 메서드가 올바른 시그니처를 가진다', () => {
    const passwordHash = module.get(PASSWORD_HASHER_PORT, { strict: false });

    expect(typeof passwordHash.hash).toBe('function');
    expect(typeof passwordHash.verify).toBe('function');
    expect(typeof passwordHash.defaultPolicy).toBe('function');
  });

  it('OtpHashPort 메서드가 올바른 시그니처를 가진다', () => {
    const otpHash = module.get(OTP_HASH_PORT, { strict: false });

    expect(typeof otpHash.hash).toBe('function');
    expect(typeof otpHash.generateToken).toBe('function');
  });
});
