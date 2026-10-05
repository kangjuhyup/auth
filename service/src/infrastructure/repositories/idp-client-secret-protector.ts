import type { EntityManager } from '@mikro-orm/core';
import type { SymmetricCryptoPort } from '@application/ports/symmetric-crypto.port';
import {
  isProtectedIdpClientSecret,
  protectIdpClientSecret,
} from '@application/services/idp-client-secret';
import { IdentityProviderOrmEntity } from '@infrastructure/mikro-orm/entities/identity-provider';

type SecretEntityManager = Pick<EntityManager, 'find' | 'flush'>;

export async function protectStoredIdpClientSecrets(
  em: SecretEntityManager,
  crypto: SymmetricCryptoPort,
): Promise<{ protectedCount: number }> {
  const providers = await em.find(IdentityProviderOrmEntity, {
    clientSecret: { $ne: null },
  });
  let protectedCount = 0;

  for (const provider of providers) {
    const secret = provider.clientSecret;
    if (!secret || isProtectedIdpClientSecret(secret)) continue;
    provider.clientSecret = protectIdpClientSecret(crypto, secret);
    protectedCount += 1;
  }

  if (protectedCount > 0) await em.flush();
  return { protectedCount };
}
