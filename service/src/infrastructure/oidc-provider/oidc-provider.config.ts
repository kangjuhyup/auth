import { type Configuration } from 'oidc-provider';
import { buildOidcAdapterFactory } from './adapters/oidc-apdater.factory';
import Redis from 'ioredis';
import { EntityManager } from '@mikro-orm/core';

export function buildOidcConfiguration(
  em?: EntityManager,
  redis?: Redis,
): Configuration {
  if (!em || !redis) {
    throw new Error('EntityManager and Redis are required');
  }

  return {
    features: {
      devInteractions: { enabled: false },
      resourceIndicators: { enabled: false },
    },

    pkce: {
      required: () => true,
    },

    scopes: ['openid', 'profile', 'email'],

    cookies: {
      keys: getSecretKeys('OIDC_COOKIE_KEYS'),
    },

    jwks: {
      keys: [],
    },

    adapter: buildOidcAdapterFactory({
      driver: process.env.OIDC_ADAPTER_DRIVER as any,
      em,
      redis,
      cacheTtlMarginSec: Number(process.env.OIDC_CACHE_TTL_MARGIN_SEC ?? 5),
      negativeTtlSec: Number(process.env.OIDC_CACHE_NEGATIVE_TTL_SEC ?? 3),
    }),

    ttl: {
      AccessToken: 60 * 60,
      AuthorizationCode: 60,
      IdToken: 60 * 60,
      RefreshToken: 14 * 24 * 60 * 60,
      Interaction: 60 * 60,
      Session: 14 * 24 * 60 * 60,
      Grant: 14 * 24 * 60 * 60,
    },
  };
}

function getSecretKeys(envKey: string): string[] {
  const raw = process.env[envKey];
  if (!raw) {
    throw new Error(`Environment variable ${envKey} is required`);
  }
  return raw.split(',').map((k) => k.trim());
}
