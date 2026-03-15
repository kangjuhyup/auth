import { SymmetricCryptoAdapter } from '@infrastructure/crypto/symmetric/symmetric-crypto.adapter';
import { randomBytes } from 'crypto';

describe('SymmetricCryptoAdapter', () => {
  const hexKey = randomBytes(32).toString('hex');
  let adapter: SymmetricCryptoAdapter;

  beforeEach(() => {
    adapter = new SymmetricCryptoAdapter(hexKey);
  });

  it('hex 64자 키로 정상 생성된다', () => {
    expect(() => new SymmetricCryptoAdapter(hexKey)).not.toThrow();
  });

  it('base64 44자 키로 정상 생성된다', () => {
    const base64Key = randomBytes(32).toString('base64');
    expect(() => new SymmetricCryptoAdapter(base64Key)).not.toThrow();
  });

  it('32바이트가 아닌 키로 생성하면 예외를 던진다', () => {
    expect(() => new SymmetricCryptoAdapter('too-short')).toThrow(
      /32 bytes/,
    );
  });

  it('encrypt → decrypt 왕복이 원본을 보존한다', () => {
    const plaintext = 'my-super-secret-client-password';
    const encrypted = adapter.encrypt(plaintext);
    const decrypted = adapter.decrypt(encrypted);

    expect(decrypted).toBe(plaintext);
  });

  it('빈 문자열도 정상 왕복된다', () => {
    const encrypted = adapter.encrypt('');
    expect(adapter.decrypt(encrypted)).toBe('');
  });

  it('한글/이모지 등 UTF-8 문자도 왕복된다', () => {
    const text = '비밀번호🔑テスト';
    const encrypted = adapter.encrypt(text);
    expect(adapter.decrypt(encrypted)).toBe(text);
  });

  it('동일 평문을 두 번 암호화하면 다른 암호문이 나온다 (IV 랜덤)', () => {
    const plaintext = 'same-input';
    const enc1 = adapter.encrypt(plaintext);
    const enc2 = adapter.encrypt(plaintext);

    expect(enc1).not.toBe(enc2);
  });

  it('암호문이 base64로 인코딩된다', () => {
    const encrypted = adapter.encrypt('test');
    expect(() => Buffer.from(encrypted, 'base64')).not.toThrow();
    expect(Buffer.from(encrypted, 'base64').toString('base64')).toBe(encrypted);
  });

  it('잘못된 암호문을 복호화하면 예외를 던진다', () => {
    expect(() => adapter.decrypt('not-valid-base64-ciphertext')).toThrow();
  });

  it('너무 짧은 암호문은 예외를 던진다', () => {
    const short = Buffer.from(new Uint8Array(10)).toString('base64');
    expect(() => adapter.decrypt(short)).toThrow(/too short/);
  });

  it('다른 키로 복호화하면 예외를 던진다', () => {
    const otherKey = randomBytes(32).toString('hex');
    const otherAdapter = new SymmetricCryptoAdapter(otherKey);

    const encrypted = adapter.encrypt('secret');
    expect(() => otherAdapter.decrypt(encrypted)).toThrow();
  });
});
