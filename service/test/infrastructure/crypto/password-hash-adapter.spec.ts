import { PasswordHashAdapter } from '@infrastructure/crypto/password/password.adapter';
import type { PasswordHash } from '@infrastructure/crypto/password/password-hash';
import type { HashPolicy } from '@application/command/ports/password-hash.port';

function createMockHasher(alg: string): jest.Mocked<PasswordHash> {
  return {
    alg,
    hash: jest.fn().mockResolvedValue(`${alg}-hashed`),
    verify: jest.fn().mockResolvedValue(true),
  };
}

describe('PasswordHashAdapter', () => {
  const defaultPolicy: HashPolicy = { alg: 'argon2id', params: {}, version: 1 };

  describe('생성', () => {
    it('기본 정책의 알고리즘이 등록되지 않으면 에러를 던진다', () => {
      const hasher = createMockHasher('pbkdf2-sha256');

      expect(
        () => new PasswordHashAdapter([hasher], { alg: 'argon2id' }),
      ).toThrow('DefaultHashAlgNotRegistered:argon2id');
    });

    it('기본 정책의 알고리즘이 등록되어 있으면 정상 생성된다', () => {
      const hasher = createMockHasher('argon2id');

      expect(
        () => new PasswordHashAdapter([hasher], defaultPolicy),
      ).not.toThrow();
    });
  });

  describe('defaultPolicy', () => {
    it('기본 정책을 반환한다', () => {
      const hasher = createMockHasher('argon2id');
      const adapter = new PasswordHashAdapter([hasher], defaultPolicy);

      const policy = adapter.defaultPolicy();

      expect(policy.alg).toBe('argon2id');
      expect(policy.version).toBe(1);
    });

    it('alg만 지정해도 params와 version이 채워진다', () => {
      const hasher = createMockHasher('argon2id');
      const adapter = new PasswordHashAdapter([hasher], { alg: 'argon2id' });

      const policy = adapter.defaultPolicy();

      expect(policy.params).toEqual({});
      expect(policy.version).toBe(1);
    });
  });

  describe('hash', () => {
    it('기본 정책으로 해싱한다', async () => {
      const hasher = createMockHasher('argon2id');
      const adapter = new PasswordHashAdapter([hasher], defaultPolicy);

      const result = await adapter.hash('plain-text');

      expect(result.alg).toBe('argon2id');
      expect(result.hash).toBe('argon2id-hashed');
      expect(hasher.hash).toHaveBeenCalledWith('plain-text', {});
    });

    it('지정된 정책으로 해싱한다', async () => {
      const argon = createMockHasher('argon2id');
      const pbkdf = createMockHasher('pbkdf2-sha256');
      const adapter = new PasswordHashAdapter([argon, pbkdf], defaultPolicy);

      const result = await adapter.hash('plain-text', {
        alg: 'pbkdf2-sha256',
        params: { iterations: 100000 },
        version: 2,
      });

      expect(result.alg).toBe('pbkdf2-sha256');
      expect(pbkdf.hash).toHaveBeenCalledWith('plain-text', { iterations: 100000 });
    });

    it('지원하지 않는 알고리즘이면 에러를 던진다', async () => {
      const hasher = createMockHasher('argon2id');
      const adapter = new PasswordHashAdapter([hasher], defaultPolicy);

      await expect(
        adapter.hash('plain-text', { alg: 'bcrypt' }),
      ).rejects.toThrow('UnsupportedAlgorithm:bcrypt');
    });
  });

  describe('verify', () => {
    it('해당 알고리즘의 hasher로 검증한다', async () => {
      const hasher = createMockHasher('argon2id');
      const adapter = new PasswordHashAdapter([hasher], defaultPolicy);

      const result = await adapter.verify('hashed', 'plain', 'argon2id');

      expect(result).toBe(true);
      expect(hasher.verify).toHaveBeenCalledWith('hashed', 'plain');
    });

    it('지원하지 않는 알고리즘이면 에러를 던진다', async () => {
      const hasher = createMockHasher('argon2id');
      const adapter = new PasswordHashAdapter([hasher], defaultPolicy);

      await expect(
        adapter.verify('hashed', 'plain', 'scrypt'),
      ).rejects.toThrow('UnsupportedAlgorithm:scrypt');
    });
  });
});
