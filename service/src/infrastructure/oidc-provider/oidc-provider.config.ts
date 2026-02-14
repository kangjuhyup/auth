import { type Configuration } from 'oidc-provider';

export function buildOidcConfiguration(): Configuration {
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
