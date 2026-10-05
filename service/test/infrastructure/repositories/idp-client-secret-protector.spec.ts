import type { SymmetricCryptoPort } from '@application/ports/symmetric-crypto.port';
import { protectStoredIdpClientSecrets } from '@infrastructure/repositories/idp-client-secret-protector';
import { SymmetricCryptoAdapter } from '@infrastructure/crypto/symmetric/symmetric-crypto.adapter';
import {
  protectIdpClientSecret,
  unprotectIdpClientSecret,
} from '@application/services/idp-client-secret';

describe('protectStoredIdpClientSecrets', () => {
  it('평문 legacy secret만 암호화하고 원문이나 암호문을 반환하지 않는다', async () => {
    const rows = [
      { clientSecret: 'legacy-secret' },
      { clientSecret: 'enc:v1:already-protected' },
      { clientSecret: null },
    ];
    const em = {
      find: jest.fn().mockResolvedValue(rows),
      flush: jest.fn().mockResolvedValue(undefined),
    };
    const crypto: jest.Mocked<SymmetricCryptoPort> = {
      encrypt: jest.fn().mockReturnValue('ciphertext'),
      decrypt: jest.fn(),
    };

    await expect(
      protectStoredIdpClientSecrets(em as never, crypto),
    ).resolves.toEqual({ protectedCount: 1 });

    expect(crypto.encrypt).toHaveBeenCalledWith('legacy-secret');
    expect(rows).toEqual([
      { clientSecret: 'enc:v1:ciphertext' },
      { clientSecret: 'enc:v1:already-protected' },
      { clientSecret: null },
    ]);
    expect(em.flush).toHaveBeenCalledTimes(1);
  });

  it('암호화 대상이 없으면 DB flush를 생략한다', async () => {
    const em = {
      find: jest
        .fn()
        .mockResolvedValue([{ clientSecret: 'enc:v1:already-protected' }]),
      flush: jest.fn(),
    };
    const crypto: jest.Mocked<SymmetricCryptoPort> = {
      encrypt: jest.fn(),
      decrypt: jest.fn(),
    };

    await expect(
      protectStoredIdpClientSecrets(em as never, crypto),
    ).resolves.toEqual({ protectedCount: 0 });
    expect(em.flush).not.toHaveBeenCalled();
  });

  it('255자 멀티바이트 secret 암호문을 2048자 컬럼 안에서 왕복한다', () => {
    const plaintext = '한'.repeat(255);
    const crypto = new SymmetricCryptoAdapter('ab'.repeat(32));

    const protectedSecret = protectIdpClientSecret(crypto, plaintext);

    expect(protectedSecret.length).toBeLessThanOrEqual(2048);
    expect(protectedSecret.length).toBeGreaterThan(512);
    expect(unprotectIdpClientSecret(crypto, protectedSecret)).toBe(plaintext);
  });
});
