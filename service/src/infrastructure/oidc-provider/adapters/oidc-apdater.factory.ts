import type { AdapterFactory } from 'oidc-provider';
import type { EntityManager } from '@mikro-orm/core';
import type { Redis } from 'ioredis';
import { RdbOidcAdapter } from './rdb-oidc.adapter';
import { RedisAdapter } from './redis-oidc.adapter';
import { HybridAdapter } from './hybrid-oidc.adapter';
import type { OidcAdapterDriver } from './oidc-adapter.constants';

export function buildOidcAdapterFactory(params: {
  driver: OidcAdapterDriver;
  em?: EntityManager;
  redis?: Redis;
  cacheTtlMarginSec?: number;
  negativeTtlSec?: number;
  backfillTtlSec?: number;
}): AdapterFactory {
  const {
    driver,
    em,
    redis,
    cacheTtlMarginSec = 5,
    negativeTtlSec = 3,
    backfillTtlSec = 60,
  } = params;

  if (driver === 'rdb') {
    if (!em) throw new Error('EntityManager is required for rdb adapter');
    return (kind) => new RdbOidcAdapter(kind, em);
  }

  if (driver === 'redis') {
    if (!redis) throw new Error('Redis client is required for redis adapter');
    return (kind) => new RedisAdapter(kind, redis);
  }

  if (driver === 'hybrid') {
    if (!em) throw new Error('EntityManager is required for hybrid adapter');
    if (!redis) throw new Error('Redis client is required for hybrid adapter');
    return (kind) =>
      new HybridAdapter({
        kind,
        rdb: new RdbOidcAdapter(kind, em),
        cache: new RedisAdapter(kind, redis),
        cacheTtlMarginSec,
        negativeTtlSec,
        backfillTtlSec,
      });
  }

  throw new Error(`Invalid adapter driver: ${driver}`);
}
