// service/test/infrastructure/crypto/otp-hash-adapter.spec.ts
import { OtpHashAdapter } from '@infrastructure/crypto/otp/otp-hash.adapter';

describe('OtpHashAdapter', () => {
  it('secret이 없거나 너무 짧으면 에러를 던진다', () => {
    expect(() => new OtpHashAdapter('')).toThrow();
    expect(() => new OtpHashAdapter('short-secret')).toThrow();
  });

  it('generateToken은 URL-safe 문자열을 생성한다', () => {
    const h = new OtpHashAdapter('0123456789abcdef');
    const token = h.generateToken(32);

    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);

    // URL-safe base64 변형: + / = 가 없어야 함
    expect(token).not.toContain('+');
    expect(token).not.toContain('/');
    expect(token).not.toContain('=');
  });

  it('hash는 같은 입력에 대해 같은 해시를 반환한다', () => {
    const h = new OtpHashAdapter('0123456789abcdef');
    const a = h.hash('plain-token');
    const b = h.hash('plain-token');

    expect(a).toBe(b);
    expect(typeof a).toBe('string');
    expect(a.length).toBeGreaterThan(0);
  });

  it('secret이 다르면 같은 plain이라도 해시가 달라진다', () => {
    const h1 = new OtpHashAdapter('0123456789abcdef');
    const h2 = new OtpHashAdapter('fedcba9876543210');

    const a = h1.hash('plain-token');
    const b = h2.hash('plain-token');

    expect(a).not.toBe(b);
  });

  it('plain이 다르면 해시가 달라진다', () => {
    const h = new OtpHashAdapter('0123456789abcdef');

    const a = h.hash('plain-token-1');
    const b = h.hash('plain-token-2');

    expect(a).not.toBe(b);
  });
});
