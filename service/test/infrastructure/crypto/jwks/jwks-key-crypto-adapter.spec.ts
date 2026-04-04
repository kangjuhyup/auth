import { JwksKeyCryptoAdapter } from '@infrastructure/crypto/jwks/jwks-key-crypto.adapter';

const VALID_KEY_HEX = 'a'.repeat(64); // 32 bytes hex

describe('JwksKeyCryptoAdapter', () => {
  describe('생성자 검증', () => {
    it('32바이트 hex 키로 생성 성공', () => {
      expect(() => new JwksKeyCryptoAdapter(VALID_KEY_HEX)).not.toThrow();
    });

    it('32바이트 base64 키로 생성 성공', () => {
      const base64Key = Buffer.alloc(32).toString('base64');
      expect(() => new JwksKeyCryptoAdapter(base64Key)).not.toThrow();
    });

    it('32바이트 미만 키 → 에러', () => {
      expect(() => new JwksKeyCryptoAdapter('short-key')).toThrow(
        'JWKS_ENCRYPTION_KEY must be exactly 32 bytes',
      );
    });
  });

  describe('generateKeyPair', () => {
    let adapter: JwksKeyCryptoAdapter;

    beforeEach(() => {
      adapter = new JwksKeyCryptoAdapter(VALID_KEY_HEX);
    });

    it('RS256 키 쌍 생성 → kid, algorithm, publicKeyPem, privateKeyEncrypted 반환', async () => {
      const result = await adapter.generateKeyPair('RS256');

      expect(result.kid).toBeTruthy();
      expect(result.algorithm).toBe('RS256');
      expect(result.publicKeyPem).toContain('BEGIN PUBLIC KEY');
      expect(result.privateKeyEncrypted).toBeTruthy();
      expect(typeof result.privateKeyEncrypted).toBe('string');
    });

    it('ES256 키 쌍 생성', async () => {
      const result = await adapter.generateKeyPair('ES256');

      expect(result.algorithm).toBe('ES256');
      expect(result.publicKeyPem).toContain('BEGIN PUBLIC KEY');
      expect(result.privateKeyEncrypted).toBeTruthy();
    });

    it('기본 알고리즘 생략 시 RS256 사용', async () => {
      const result = await adapter.generateKeyPair();

      expect(result.algorithm).toBe('RS256');
    });

    it('호출마다 다른 kid 생성', async () => {
      const [r1, r2] = await Promise.all([
        adapter.generateKeyPair('RS256'),
        adapter.generateKeyPair('RS256'),
      ]);

      expect(r1.kid).not.toBe(r2.kid);
    });

    it('privateKeyEncrypted는 base64 문자열', async () => {
      const result = await adapter.generateKeyPair('RS256');
      const decoded = Buffer.from(result.privateKeyEncrypted, 'base64');

      // iv(12) + authTag(16) + ciphertext ≥ 28 bytes
      expect(decoded.length).toBeGreaterThan(28);
    });
  });
});
