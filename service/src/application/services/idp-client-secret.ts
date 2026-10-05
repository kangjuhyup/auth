import type { SymmetricCryptoPort } from '@application/ports/symmetric-crypto.port';

const IDP_CLIENT_SECRET_PREFIX = 'enc:v1:';

export function protectIdpClientSecret(
  crypto: SymmetricCryptoPort,
  plaintext: string,
): string {
  return `${IDP_CLIENT_SECRET_PREFIX}${crypto.encrypt(plaintext)}`;
}

export function unprotectIdpClientSecret(
  crypto: SymmetricCryptoPort,
  protectedSecret: string,
): string {
  if (!isProtectedIdpClientSecret(protectedSecret)) {
    throw new Error('IdP client secret is not protected');
  }
  return crypto.decrypt(protectedSecret.slice(IDP_CLIENT_SECRET_PREFIX.length));
}

export function isProtectedIdpClientSecret(value: string): boolean {
  return value.startsWith(IDP_CLIENT_SECRET_PREFIX);
}
