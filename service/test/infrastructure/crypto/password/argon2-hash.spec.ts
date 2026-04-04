import { Argon2idHash } from '@infrastructure/crypto/password/impl/argon2-hash';

describe('Argon2idHash', () => {
  let hasher: Argon2idHash;

  beforeEach(() => {
    hasher = new Argon2idHash();
  });

  it('alg는 "argon2id"', () => {
    expect(hasher.alg).toBe('argon2id');
  });

  describe('hash', () => {
    it('argon2id 포맷 문자열 반환', async () => {
      const result = await hasher.hash('plaintext');
      expect(result).toMatch(/^\$argon2id\$/);
    });

    it('동일 평문을 두 번 해싱 → 다른 결과 (salt 랜덤)', async () => {
      const [h1, h2] = await Promise.all([
        hasher.hash('same-password'),
        hasher.hash('same-password'),
      ]);

      expect(h1).not.toBe(h2);
    });

    it('커스텀 timeCost 파라미터 적용', async () => {
      const result = await hasher.hash('plaintext', { timeCost: 1 });
      expect(result).toMatch(/^\$argon2id\$/);
    });

    it('유효하지 않은 timeCost(-1) → 기본값 사용 (에러 없음)', async () => {
      await expect(hasher.hash('plaintext', { timeCost: -1 })).resolves.toMatch(/^\$argon2id\$/);
    });

    it('유효하지 않은 memoryCost → 기본값 사용 (에러 없음)', async () => {
      await expect(hasher.hash('plaintext', { memoryCost: 0 })).resolves.toMatch(/^\$argon2id\$/);
    });
  });

  describe('verify', () => {
    it('올바른 평문 → true', async () => {
      const hash = await hasher.hash('correct-password');
      expect(await hasher.verify(hash, 'correct-password')).toBe(true);
    });

    it('틀린 평문 → false', async () => {
      const hash = await hasher.hash('correct-password');
      expect(await hasher.verify(hash, 'wrong-password')).toBe(false);
    });
  });
});
