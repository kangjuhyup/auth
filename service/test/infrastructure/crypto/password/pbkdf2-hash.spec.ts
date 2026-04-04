import { Pbkdf2Sha256Hash } from '@infrastructure/crypto/password/impl/pbkdf-hash';

describe('Pbkdf2Sha256Hash', () => {
  let hasher: Pbkdf2Sha256Hash;

  beforeEach(() => {
    hasher = new Pbkdf2Sha256Hash();
  });

  it('alg는 "pbkdf2-sha256"', () => {
    expect(hasher.alg).toBe('pbkdf2-sha256');
  });

  describe('hash', () => {
    it('pbkdf2$sha256$<itr>$<salt>$<dk> 포맷 반환', async () => {
      const result = await hasher.hash('plaintext');

      const parts = result.split('$');
      expect(parts).toHaveLength(5);
      expect(parts[0]).toBe('pbkdf2');
      expect(parts[1]).toBe('sha256');
      expect(Number(parts[2])).toBeGreaterThan(0);
      expect(parts[3]).toBeTruthy(); // saltB64
      expect(parts[4]).toBeTruthy(); // dkB64
    });

    it('동일 평문을 두 번 해싱 → 다른 결과 (salt 랜덤)', async () => {
      const [h1, h2] = await Promise.all([
        hasher.hash('same-password'),
        hasher.hash('same-password'),
      ]);

      expect(h1).not.toBe(h2);
    });

    it('커스텀 iterations 파라미터 적용', async () => {
      const result = await hasher.hash('plaintext', { iterations: 1000 });

      const parts = result.split('$');
      expect(parts[2]).toBe('1000');
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

    it('잘못된 포맷(4 파트) → false', async () => {
      expect(await hasher.verify('pbkdf2$sha256$100$salt', 'pw')).toBe(false);
    });

    it('잘못된 prefix → false', async () => {
      expect(await hasher.verify('bcrypt$sha256$100$salt$dk', 'pw')).toBe(false);
    });

    it('잘못된 digest → false', async () => {
      expect(await hasher.verify('pbkdf2$md5$100$salt$dk', 'pw')).toBe(false);
    });

    it('iterations가 0 이하 → false', async () => {
      expect(await hasher.verify('pbkdf2$sha256$0$salt$dk', 'pw')).toBe(false);
    });

    it('iterations가 NaN → false', async () => {
      expect(await hasher.verify('pbkdf2$sha256$abc$salt$dk', 'pw')).toBe(false);
    });
  });
});
