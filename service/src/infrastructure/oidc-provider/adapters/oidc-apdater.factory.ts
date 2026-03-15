import type { AdapterFactory } from 'oidc-provider';
import type { EntityManager } from '@mikro-orm/core';
import type { Redis } from 'ioredis';
import { RdbOidcAdapter } from './rdb-oidc.adapter';
import { RedisAdapter } from './redis-oidc.adapter';
import { HybridAdapter } from './hybrid-oidc.adapter';
import { ClientOidcAdapter } from './client-oidc.adapter';
import type { OidcAdapterDriver } from './oidc-adapter.constants';
import type { ClientRepository, TenantRepository } from '@domain/repositories';
import type { SymmetricCryptoPort } from '@application/ports/symmetric-crypto.port';

export function buildOidcAdapterFactory(params: {
  driver: OidcAdapterDriver;
  em?: EntityManager;
  redis?: Redis;
  cacheTtlMarginSec?: number;
  negativeTtlSec?: number;
  backfillTtlSec?: number;
  tenantCode: string;
  clientRepository: ClientRepository;
  tenantRepository: TenantRepository;
  symmetricCrypto: SymmetricCryptoPort;
}): AdapterFactory {
  const {
    driver,
    em,
    redis,
    cacheTtlMarginSec = 5,
    negativeTtlSec = 3,
    backfillTtlSec = 60,
    tenantCode,
    clientRepository,
    tenantRepository,
    symmetricCrypto,
  } = params;

  const buildDefault = (kind: string) => {
    if (driver === 'rdb') {
      if (!em) throw new Error('EntityManager is required for rdb adapter');
      return new RdbOidcAdapter(kind, em);
    }

    if (driver === 'redis') {
      if (!redis) throw new Error('Redis client is required for redis adapter');
      return new RedisAdapter(kind, redis);
    }

    if (driver === 'hybrid') {
      if (!em) throw new Error('EntityManager is required for hybrid adapter');
      if (!redis) throw new Error('Redis client is required for hybrid adapter');
      return new HybridAdapter({
        kind,
        rdb: new RdbOidcAdapter(kind, em),
        cache: new RedisAdapter(kind, redis),
        cacheTtlMarginSec,
        negativeTtlSec,
        backfillTtlSec,
      });
    }

    throw new Error(`Invalid adapter driver: ${driver}`);
  };

  return (kind: string) => {
    if (kind === 'Client') {
      return new ClientOidcAdapter(
        tenantCode,
        clientRepository,
        tenantRepository,
        symmetricCrypto,
      );
    }

    return buildDefault(kind);
  };
}
