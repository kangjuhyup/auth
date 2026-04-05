import { createPrivateKey } from 'node:crypto';
import type { EntityManager } from '@mikro-orm/core';
import type Redis from 'ioredis';
import type Provider from 'oidc-provider';
import { ConfigService } from '@nestjs/config';
import { buildOidcConfiguration } from './oidc-provider.config';
import { ClientQueryPort } from '@application/queries/ports/client-query.port';
import { UserQueryPort } from '@application/queries/ports/user-query.port';
import { loadOidcProviderConstructor } from './oidc-provider.loader';
import type { ClientRepository, JwksKeyRepository, TenantRepository, TenantConfigRepository } from '@domain/repositories';
import type { SymmetricCryptoPort } from '@application/ports/symmetric-crypto.port';
import type { JwksKeyCryptoPort } from '@application/ports/jwks-key-crypto.port';
import { JwksKeyModel } from '@domain/models/jwks-key';

export type CreateOidcProviderParams = {
  issuer: string;
  em: EntityManager;
  redis: Redis;
  userQuery: UserQueryPort;
  clientQuery: ClientQueryPort;
  configService: ConfigService;
  tenantCode: string;
  clientRepository: ClientRepository;
  tenantRepository: TenantRepository;
  tenantConfigRepository: TenantConfigRepository;
  jwksKeyRepository: JwksKeyRepository;
  jwksKeyCrypto: JwksKeyCryptoPort;
  symmetricCrypto: SymmetricCryptoPort;
};

const DEFAULT_ACCESS_TOKEN_TTL = 60 * 60;
const DEFAULT_REFRESH_TOKEN_TTL = 14 * 24 * 60 * 60;

export async function createOidcProvider(
  params: CreateOidcProviderParams,
): Promise<Provider> {
  const tenant = await params.tenantRepository.findByCode(params.tenantCode);
  const tenantConfig = tenant
    ? await params.tenantConfigRepository.findByTenantId(tenant.id)
    : null;

  // Load (or auto-generate) JWKS signing keys for this tenant
  let keyModels = tenant
    ? await params.jwksKeyRepository.findActiveByTenantId(tenant.id)
    : [];

  if (keyModels.length === 0 && tenant) {
    const generated = await params.jwksKeyCrypto.generateKeyPair('RS256');
    const newKey = new JwksKeyModel({
      kid: generated.kid,
      tenantId: tenant.id,
      algorithm: generated.algorithm,
      publicKey: generated.publicKeyPem,
      privateKeyEnc: generated.privateKeyEncrypted,
      status: 'active',
      createdAt: new Date(),
    });
    await params.jwksKeyRepository.save(newKey);
    keyModels = [newKey];
  }

  const jwksKeys = keyModels.map((km) => {
    const privatePem = params.symmetricCrypto.decrypt(km.privateKeyEnc);
    const keyObj = createPrivateKey(privatePem);
    const jwk = keyObj.export({ format: 'jwk' }) as Record<string, unknown>;
    return { ...jwk, kid: km.kid, alg: km.algorithm, use: 'sig' };
  });

  const configuration = buildOidcConfiguration({
    em: params.em,
    redis: params.redis,
    userQuery: params.userQuery,
    clientQuery: params.clientQuery,
    configService: params.configService,
    tenantCode: params.tenantCode,
    clientRepository: params.clientRepository,
    tenantRepository: params.tenantRepository,
    symmetricCrypto: params.symmetricCrypto,
    jwksKeys,
    tenantAccessTokenTtlSec: tenantConfig?.accessTokenTtlSec ?? DEFAULT_ACCESS_TOKEN_TTL,
    tenantRefreshTokenTtlSec: tenantConfig?.refreshTokenTtlSec ?? DEFAULT_REFRESH_TOKEN_TTL,
  });

  const Provider = await loadOidcProviderConstructor();

  return new Provider(params.issuer, configuration);
}
