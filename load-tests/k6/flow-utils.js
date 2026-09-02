const CALLBACK_ORIGIN = 'http://localhost:18080';
const CALLBACK_PATH = '/callback';

function base64Url(value) {
  if (typeof value !== 'string' || value.length === 0 || !/^[\x20-\x7e]+$/.test(value)) {
    throw new TypeError('PKCE seed must be a non-empty ASCII string');
  }
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function parsedLocation(location, baseUrl) {
  if (typeof location !== 'string' || location.length === 0) {
    throw new TypeError('redirect location is required');
  }
  try {
    return new URL(location, baseUrl);
  } catch {
    throw new Error('invalid redirect location');
  }
}

function providerUrl(location, serviceOrigin) {
  const origin = parsedLocation(serviceOrigin).origin;
  const url = parsedLocation(location, origin);
  if (url.origin !== origin) {
    throw new Error('redirect must use the configured provider origin');
  }
  return url;
}

export function buildPkce(seed, sha256) {
  if (typeof sha256 !== 'function') throw new TypeError('PKCE hash must be a function');
  const verifier = base64Url(seed);
  if (verifier.length < 43 || verifier.length > 128) {
    throw new RangeError('PKCE verifier must be between 43 and 128 characters');
  }
  const challenge = sha256(verifier);
  if (typeof challenge !== 'string' || challenge.length === 0) {
    throw new TypeError('PKCE hash must return a non-empty string');
  }
  return { verifier, challenge };
}

export function extractInteractionUid(location, serviceOrigin) {
  const url = providerUrl(location, serviceOrigin);
  if (url.search || url.hash) throw new Error('redirect must use an exact interaction path');
  const match = /^\/t\/[^/]+\/interaction\/([A-Za-z0-9._~-]+)$/.exec(url.pathname);
  if (!match) throw new Error('redirect must use an exact interaction path');
  return match[1];
}

export function assertProviderResumePath(location, serviceOrigin) {
  const url = providerUrl(location, serviceOrigin);
  if (!/^\/t\/[^/]+\/oidc\/auth(?:\/[A-Za-z0-9._~-]+)?$/.test(url.pathname) || url.hash) {
    throw new Error('redirect must use an exact provider resume path');
  }
  return url.href;
}

export function extractAuthorizationCode(location) {
  const url = parsedLocation(location);
  if (url.origin !== CALLBACK_ORIGIN || url.pathname !== CALLBACK_PATH || url.hash) {
    throw new Error('redirect must use the configured RP redirect URI');
  }
  const code = url.searchParams.get('code');
  if (!code) throw new Error('callback does not contain an authorization code');
  return { code, state: url.searchParams.get('state') };
}

export function chooseAction(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError('action selection value must be between 0 and 1');
  }
  if (value < 0.45) return 'introspection';
  if (value < 0.70) return 'userinfo';
  if (value < 0.82) return 'refresh';
  if (value < 0.90) return 'discovery';
  if (value < 0.95) return 'jwks';
  return 'relogin';
}
