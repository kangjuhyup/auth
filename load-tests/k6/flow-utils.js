const CALLBACK_ORIGIN = 'http://localhost:18080';
const CALLBACK_PATH = '/callback';
const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const ABSOLUTE_URL_PATTERN =
  /^([a-z][a-z0-9+.-]*):\/\/(\[[0-9a-f:.]+\]|[a-z0-9.-]+)(?::([0-9]+))?(\/[^?#]*)?(\?[^#]*)?(#.*)?$/i;

function base64Url(value) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    !/^[\x20-\x7e]+$/.test(value)
  ) {
    throw new TypeError('PKCE seed must be a non-empty ASCII string');
  }
  let encoded = '';
  for (let index = 0; index < value.length; index += 3) {
    const first = value.charCodeAt(index);
    const second = value.charCodeAt(index + 1);
    const third = value.charCodeAt(index + 2);
    encoded += BASE64_ALPHABET[first >> 2];
    encoded += BASE64_ALPHABET[((first & 0b11) << 4) | (second >> 4)];
    if (!Number.isNaN(second))
      encoded += BASE64_ALPHABET[((second & 0b1111) << 2) | (third >> 6)];
    if (!Number.isNaN(third)) encoded += BASE64_ALPHABET[third & 0b111111];
  }
  return encoded.replace(/\+/g, '-').replace(/\//g, '_');
}

function parsedAbsoluteLocation(location) {
  const match = ABSOLUTE_URL_PATTERN.exec(location);
  if (!match) throw new Error('invalid redirect location');
  const [, protocol, hostname, rawPort, rawPathname, search = '', hash = ''] =
    match;
  if (rawPort && (Number(rawPort) < 1 || Number(rawPort) > 65535)) {
    throw new Error('invalid redirect location');
  }
  const origin = `${protocol.toLowerCase()}://${hostname.toLowerCase()}${rawPort ? `:${rawPort}` : ''}`;
  const pathname = rawPathname || '/';
  return {
    origin,
    pathname,
    search,
    hash,
    href: `${origin}${pathname}${search}${hash}`,
  };
}

function parsedLocation(location, baseUrl) {
  if (typeof location !== 'string' || location.length === 0) {
    throw new TypeError('redirect location is required');
  }
  if (!location.startsWith('/')) return parsedAbsoluteLocation(location);
  if (typeof baseUrl !== 'string') throw new Error('invalid redirect location');
  const base = parsedAbsoluteLocation(baseUrl);
  return parsedAbsoluteLocation(`${base.origin}${location}`);
}

function queryValues(search, name) {
  if (!search) return [];
  const values = [];
  for (const part of search.slice(1).split('&')) {
    const separator = part.indexOf('=');
    const rawKey = separator < 0 ? part : part.slice(0, separator);
    const rawValue = separator < 0 ? '' : part.slice(separator + 1);
    let key;
    let value;
    try {
      key = decodeURIComponent(rawKey.replace(/\+/g, ' '));
      value = decodeURIComponent(rawValue.replace(/\+/g, ' '));
    } catch {
      throw new Error('invalid redirect query encoding');
    }
    if (key === name) values.push(value);
  }
  return values;
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
  if (typeof sha256 !== 'function')
    throw new TypeError('PKCE hash must be a function');
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
  if (url.search || url.hash)
    throw new Error('redirect must use an exact interaction path');
  const match = /^\/t\/[^/]+\/interaction\/([A-Za-z0-9._~-]+)$/.exec(
    url.pathname,
  );
  if (!match) throw new Error('redirect must use an exact interaction path');
  return match[1];
}

export function assertProviderResumePath(location, serviceOrigin) {
  const url = providerUrl(location, serviceOrigin);
  if (
    !/^\/t\/[^/]+\/oidc\/auth(?:\/[A-Za-z0-9._~-]+)?$/.test(url.pathname) ||
    url.hash
  ) {
    throw new Error('redirect must use an exact provider resume path');
  }
  return url.href;
}

export function extractAuthorizationCode(location) {
  const url = parsedLocation(location);
  if (
    url.origin !== CALLBACK_ORIGIN ||
    url.pathname !== CALLBACK_PATH ||
    url.hash
  ) {
    throw new Error('redirect must use the configured RP redirect URI');
  }
  const codes = queryValues(url.search, 'code');
  if (codes.length !== 1 || !codes[0]) {
    throw new Error('callback must contain exactly one authorization code');
  }
  const states = queryValues(url.search, 'state');
  if (states.length !== 1 || !states[0]) {
    throw new Error('callback must contain exactly one state');
  }
  return { code: codes[0], state: states[0] };
}

function authorizationContinuationError() {
  return new Error('authorization continuation failed');
}

export function resolveAuthorizationCodeWithConsent(
  location,
  serviceOrigin,
  handlers,
) {
  if (
    typeof handlers?.readConsentDetails !== 'function' ||
    typeof handlers?.submitConsent !== 'function' ||
    typeof handlers?.resumeProvider !== 'function'
  ) {
    throw authorizationContinuationError();
  }

  function resolve(currentLocation, remainingConsentSteps) {
    try {
      return extractAuthorizationCode(currentLocation);
    } catch {
      // A provider interaction is the only permitted non-callback location.
    }

    if (remainingConsentSteps < 1) throw authorizationContinuationError();

    try {
      const uid = extractInteractionUid(currentLocation, serviceOrigin);
      const details = handlers.readConsentDetails(uid);
      if (
        !details ||
        typeof details !== 'object' ||
        details.uid !== uid ||
        details.prompt !== 'consent'
      ) {
        throw authorizationContinuationError();
      }

      const consent = handlers.submitConsent(uid);
      if (
        !consent ||
        typeof consent !== 'object' ||
        consent.success !== true ||
        typeof consent.redirectTo !== 'string' ||
        consent.redirectTo.length === 0
      ) {
        throw authorizationContinuationError();
      }

      const resumeUrl = assertProviderResumePath(
        consent.redirectTo,
        serviceOrigin,
      );
      const nextLocation = handlers.resumeProvider(resumeUrl);
      if (typeof nextLocation !== 'string' || nextLocation.length === 0) {
        throw authorizationContinuationError();
      }
      return resolve(nextLocation, remainingConsentSteps - 1);
    } catch {
      throw authorizationContinuationError();
    }
  }

  return resolve(location, 1);
}

export function oidcTokenProfiles(resource) {
  if (typeof resource !== 'string' || resource.length === 0) {
    throw new TypeError('resource audience is required');
  }
  return {
    resource: {
      resource,
      scope: 'openid profile email offline_access',
      requiresRefreshToken: true,
    },
    userinfo: {
      scope: 'openid profile email',
      requiresRefreshToken: false,
    },
  };
}

export function createOidcSession(resourceTokens, userinfoTokens) {
  if (
    typeof resourceTokens?.accessToken !== 'string' ||
    resourceTokens.accessToken.length === 0
  ) {
    throw new Error('OIDC session resource access token missing');
  }
  if (
    typeof resourceTokens?.refreshToken !== 'string' ||
    resourceTokens.refreshToken.length === 0
  ) {
    throw new Error('OIDC session resource refresh token missing');
  }
  if (
    typeof userinfoTokens?.accessToken !== 'string' ||
    userinfoTokens.accessToken.length === 0
  ) {
    throw new Error('OIDC session UserInfo token missing');
  }
  return {
    accessToken: resourceTokens.accessToken,
    refreshToken: resourceTokens.refreshToken,
    userinfoAccessToken: userinfoTokens.accessToken,
  };
}

export function refreshOidcSession(session, resourceTokens) {
  return createOidcSession(resourceTokens, {
    accessToken: session?.userinfoAccessToken,
  });
}

export function chooseAction(value) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    value >= 1
  ) {
    throw new RangeError('action selection value must be between 0 and 1');
  }
  if (value < 0.45) return 'introspection';
  if (value < 0.7) return 'userinfo';
  if (value < 0.82) return 'refresh';
  if (value < 0.9) return 'discovery';
  if (value < 0.95) return 'jwks';
  return 'relogin';
}
