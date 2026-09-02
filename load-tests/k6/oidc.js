import { check } from 'k6';
import crypto from 'k6/crypto';
import encoding from 'k6/encoding';
import exec from 'k6/execution';
import http from 'k6/http';
import {
  assertProviderResumePath,
  buildPkce,
  createOidcSession,
  extractInteractionUid,
  oidcTokenProfiles,
  refreshOidcSession,
  resolveAuthorizationCodeWithConsent,
} from './flow-utils.js';
import {
  recordCheck,
  recordCompletedLogin,
  recordResponse,
} from './metrics.js';
import { userNameFor } from './payloads.js';

const CALLBACK_URI = 'http://localhost:18080/callback';
const RESOURCE = 'https://resource.example.test';
const PUBLIC_CLIENT_ID = 'loadtest-web';
const SERVICE_CLIENT_ID = 'loadtest-resource-server';
const JSON_HEADERS = Object.freeze({ 'Content-Type': 'application/json' });
const FORM_HEADERS = Object.freeze({
  'Content-Type': 'application/x-www-form-urlencoded',
});

function requiredConfig(config, name) {
  const value = config?.[name];
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${name} is required`);
  }
  return value;
}

function formBody(values) {
  return Object.entries(values)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    )
    .join('&');
}

function endpointUrls(config) {
  const issuer = `${requiredConfig(config, 'baseUrl')}/t/${requiredConfig(config, 'tenantCode')}/oidc`;
  return Object.freeze({
    authorization: `${issuer}/auth`,
    token: `${issuer}/token`,
    userinfo: `${issuer}/me`,
    introspection: `${issuer}/token/introspection`,
    revocation: `${issuer}/token/revocation`,
    discovery: `${issuer}/.well-known/openid-configuration`,
    jwks: `${issuer}/jwks`,
    interaction: `${requiredConfig(config, 'baseUrl')}/t/${requiredConfig(config, 'tenantCode')}/interaction`,
  });
}

function randomUrlValue() {
  return encoding.b64encode(crypto.randomBytes(32), 'rawurl');
}

function protocolError(endpoint, status, code = 'protocol_check_failed') {
  return new Error(
    `${endpoint} failed with status ${Number.isSafeInteger(status) ? status : 0}: ${code}`,
  );
}

function safeProviderError(response) {
  if (typeof response?.body !== 'string' || response.body.length === 0)
    return undefined;
  try {
    const error = JSON.parse(response.body)?.error;
    return typeof error === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(error)
      ? error
      : undefined;
  } catch {
    return undefined;
  }
}

function responseStatus(
  response,
  endpoint,
  acceptedStatuses,
  measuring,
  metricRecorder,
  metricContext,
) {
  const accepted = acceptedStatuses.includes(response.status);
  const context = metricContext();
  metricRecorder.recordResponse({
    response,
    endpoint,
    measuring,
    acceptedStatuses,
    ...context,
  });
  const passed = check(response, {
    [`oidc ${endpoint} response`]: () => accepted,
  });
  metricRecorder.recordCheck(passed, measuring, context);
  if (!accepted)
    throw protocolError(endpoint, response.status, safeProviderError(response));
  return response;
}

function requireProtocol(
  condition,
  endpoint,
  response,
  measuring,
  metricRecorder,
  metricContext,
  checkName,
) {
  const passed = check(null, {
    [`oidc ${endpoint} ${checkName}`]: () => condition,
  });
  metricRecorder.recordCheck(passed, measuring, metricContext());
  if (!passed) throw protocolError(endpoint, response?.status);
}

function parsedJson(
  response,
  endpoint,
  measuring,
  metricRecorder,
  metricContext,
) {
  try {
    const parsed = response.json();
    requireProtocol(
      parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed),
      endpoint,
      response,
      measuring,
      metricRecorder,
      metricContext,
      'JSON payload',
    );
    return parsed;
  } catch (error) {
    if (
      error instanceof Error &&
      /^.+ failed with status \d+: /.test(error.message)
    )
      throw error;
    throw protocolError(endpoint, response.status);
  }
}

function validToken(value) {
  return typeof value === 'string' && value.length > 0;
}

function defaultMetricRecorder() {
  return { recordResponse, recordCheck, recordCompletedLogin };
}

export function createOidcClient(
  config,
  metricRecorder = defaultMetricRecorder(),
) {
  const urls = endpointUrls(config);
  const userPassword = requiredConfig(config, 'loadUserPassword');
  const serviceClientSecret = requiredConfig(config, 'serviceClientSecret');
  const publicClientId = config.publicClientId ?? PUBLIC_CLIENT_ID;
  const serviceClientId = config.serviceClientId ?? SERVICE_CLIENT_ID;
  const resource = config.resource ?? RESOURCE;
  const tokenProfiles = oidcTokenProfiles(resource);

  if (
    !metricRecorder ||
    typeof metricRecorder.recordResponse !== 'function' ||
    typeof metricRecorder.recordCheck !== 'function' ||
    typeof metricRecorder.recordCompletedLogin !== 'function'
  ) {
    throw new TypeError(
      'metricRecorder must provide response, check, and login recorders',
    );
  }

  const metricContext = () => ({
    runKind: config.runKind,
    ...(typeof config.measurementMinute === 'function'
      ? { minute: config.measurementMinute() }
      : {}),
  });

  function authorizeTokens(userIndex, measuring, forceLogin, profile) {
    const jar = new http.CookieJar();
    const random = randomUrlValue();
    const pkce = buildPkce(
      `vu:${exec.vu.idInTest};iteration:${exec.vu.iterationInScenario};random:${random}`,
      (verifier) => crypto.sha256(verifier, 'base64rawurl'),
    );
    const state = randomUrlValue();
    const nonce = randomUrlValue();
    const authorizeQuery = formBody({
      client_id: publicClientId,
      code_challenge: pkce.challenge,
      code_challenge_method: 'S256',
      nonce,
      prompt: forceLogin ? 'login consent' : 'consent',
      redirect_uri: CALLBACK_URI,
      response_type: 'code',
      scope: profile.scope,
      state,
      ...(profile.resource ? { resource: profile.resource } : {}),
    });
    const authorization = responseStatus(
      http.get(`${urls.authorization}?${authorizeQuery}`, {
        jar,
        redirects: 0,
        responseType: 'none',
      }),
      'login',
      [302, 303],
      measuring,
      metricRecorder,
      metricContext,
    );

    let uid;
    try {
      uid = extractInteractionUid(
        authorization.headers.Location,
        config.baseUrl,
      );
    } catch {
      throw protocolError('login', authorization.status);
    }

    const detailsResponse = responseStatus(
      http.get(`${urls.interaction}/${encodeURIComponent(uid)}/api/details`, {
        jar,
        responseType: 'text',
      }),
      'login',
      [200],
      measuring,
      metricRecorder,
      metricContext,
    );
    const details = parsedJson(
      detailsResponse,
      'login',
      measuring,
      metricRecorder,
      metricContext,
    );
    requireProtocol(
      details.uid === uid &&
        (details.prompt === 'login' || details.prompt === 'consent'),
      'login',
      detailsResponse,
      measuring,
      metricRecorder,
      metricContext,
      'interaction prompt',
    );
    let continuationLocation = authorization.headers.Location;
    if (details.prompt === 'login') {
      const loginResponse = responseStatus(
        http.post(
          `${urls.interaction}/${encodeURIComponent(uid)}/api/login`,
          JSON.stringify({
            username: userNameFor(userIndex),
            password: userPassword,
          }),
          { jar, headers: JSON_HEADERS, responseType: 'text' },
        ),
        'login',
        [200],
        measuring,
        metricRecorder,
        metricContext,
      );
      const interaction = parsedJson(
        loginResponse,
        'login',
        measuring,
        metricRecorder,
        metricContext,
      );
      const redirectTo = interaction.redirectTo;
      requireProtocol(
        typeof redirectTo === 'string' && redirectTo.length > 0,
        'login',
        loginResponse,
        measuring,
        metricRecorder,
        metricContext,
        'resume redirect',
      );

      let resumeUrl;
      try {
        resumeUrl = assertProviderResumePath(redirectTo, config.baseUrl);
      } catch {
        throw protocolError('login', loginResponse.status);
      }
      continuationLocation = responseStatus(
        http.get(resumeUrl, { jar, redirects: 0, responseType: 'none' }),
        'login',
        [302, 303],
        measuring,
        metricRecorder,
        metricContext,
      ).headers.Location;
    }
    let cachedConsentDetails =
      details.prompt === 'consent' ? details : undefined;
    const callback = resolveAuthorizationCodeWithConsent(
      continuationLocation,
      config.baseUrl,
      {
        readConsentDetails: (consentUid) => {
          if (cachedConsentDetails?.uid === consentUid) {
            const cached = cachedConsentDetails;
            cachedConsentDetails = undefined;
            return cached;
          }
          const response = responseStatus(
            http.get(
              `${urls.interaction}/${encodeURIComponent(consentUid)}/api/details`,
              { jar, responseType: 'text' },
            ),
            'login',
            [200],
            measuring,
            metricRecorder,
            metricContext,
          );
          return parsedJson(
            response,
            'login',
            measuring,
            metricRecorder,
            metricContext,
          );
        },
        submitConsent: (consentUid) => {
          const response = responseStatus(
            http.post(
              `${urls.interaction}/${encodeURIComponent(consentUid)}/api/consent`,
              null,
              { jar, responseType: 'text' },
            ),
            'login',
            [201],
            measuring,
            metricRecorder,
            metricContext,
          );
          return parsedJson(
            response,
            'login',
            measuring,
            metricRecorder,
            metricContext,
          );
        },
        resumeProvider: (consentResumeUrl) =>
          responseStatus(
            http.get(consentResumeUrl, {
              jar,
              redirects: 0,
              responseType: 'none',
            }),
            'login',
            [302, 303],
            measuring,
            metricRecorder,
            metricContext,
          ).headers.Location,
      },
    );
    requireProtocol(
      callback.state === state,
      'login',
      authorization,
      measuring,
      metricRecorder,
      metricContext,
      'callback state',
    );

    const tokenResponse = responseStatus(
      http.post(
        urls.token,
        formBody({
          grant_type: 'authorization_code',
          client_id: publicClientId,
          redirect_uri: CALLBACK_URI,
          code: callback.code,
          code_verifier: pkce.verifier,
          ...(profile.resource ? { resource: profile.resource } : {}),
        }),
        { jar, headers: FORM_HEADERS, responseType: 'text' },
      ),
      'login',
      [200],
      measuring,
      metricRecorder,
      metricContext,
    );
    const tokens = parsedJson(
      tokenResponse,
      'login',
      measuring,
      metricRecorder,
      metricContext,
    );
    requireProtocol(
      validToken(tokens.access_token) &&
        (!profile.requiresRefreshToken || validToken(tokens.refresh_token)),
      'login',
      tokenResponse,
      measuring,
      metricRecorder,
      metricContext,
      'token response',
    );
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
    };
  }

  function login(userIndex, measuring, forceLogin = false) {
    const resourceTokens = authorizeTokens(
      userIndex,
      measuring,
      forceLogin,
      tokenProfiles.resource,
    );
    const userinfoTokens = authorizeTokens(
      userIndex,
      measuring,
      forceLogin,
      tokenProfiles.userinfo,
    );
    metricRecorder.recordCompletedLogin(measuring, metricContext());
    return createOidcSession(resourceTokens, userinfoTokens);
  }

  function introspect(session, measuring) {
    const response = responseStatus(
      http.post(urls.introspection, formBody({ token: session.accessToken }), {
        headers: {
          ...FORM_HEADERS,
          Authorization: `Basic ${encoding.b64encode(`${serviceClientId}:${serviceClientSecret}`)}`,
        },
        responseType: 'text',
      }),
      'introspection',
      [200],
      measuring,
      metricRecorder,
      metricContext,
    );
    const body = parsedJson(
      response,
      'introspection',
      measuring,
      metricRecorder,
      metricContext,
    );
    requireProtocol(
      body.active === true,
      'introspection',
      response,
      measuring,
      metricRecorder,
      metricContext,
      'active token',
    );
  }

  function userinfo(session, measuring) {
    responseStatus(
      http.get(urls.userinfo, {
        headers: { Authorization: `Bearer ${session.userinfoAccessToken}` },
        responseType: 'none',
      }),
      'userinfo',
      [200],
      measuring,
      metricRecorder,
      metricContext,
    );
  }

  function refresh(session, measuring) {
    const response = responseStatus(
      http.post(
        urls.token,
        formBody({
          grant_type: 'refresh_token',
          client_id: publicClientId,
          refresh_token: session.refreshToken,
          resource,
        }),
        { headers: FORM_HEADERS, responseType: 'text' },
      ),
      'refresh',
      [200],
      measuring,
      metricRecorder,
      metricContext,
    );
    const tokens = parsedJson(
      response,
      'refresh',
      measuring,
      metricRecorder,
      metricContext,
    );
    requireProtocol(
      validToken(tokens.access_token) && validToken(tokens.refresh_token),
      'refresh',
      response,
      measuring,
      metricRecorder,
      metricContext,
      'rotated token response',
    );
    return refreshOidcSession(session, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
    });
  }

  function discovery(measuring) {
    responseStatus(
      http.get(urls.discovery, { responseType: 'none' }),
      'discovery',
      [200],
      measuring,
      metricRecorder,
      metricContext,
    );
  }

  function jwks(measuring) {
    responseStatus(
      http.get(urls.jwks, { responseType: 'none' }),
      'jwks',
      [200],
      measuring,
      metricRecorder,
      metricContext,
    );
  }

  function revokeAndRelogin(session, userIndex, measuring) {
    responseStatus(
      http.post(
        urls.revocation,
        formBody({
          token: session.refreshToken,
          token_type_hint: 'refresh_token',
          client_id: publicClientId,
        }),
        { headers: FORM_HEADERS, responseType: 'none' },
      ),
      'revoke',
      [200],
      measuring,
      metricRecorder,
      metricContext,
    );
    return login(userIndex, measuring, true);
  }

  function execute(action, session, userIndex, measuring) {
    switch (action) {
      case 'introspection':
        introspect(session, measuring);
        return session;
      case 'userinfo':
        userinfo(session, measuring);
        return session;
      case 'refresh':
        return refresh(session, measuring);
      case 'discovery':
        discovery(measuring);
        return session;
      case 'jwks':
        jwks(measuring);
        return session;
      case 'relogin':
        return revokeAndRelogin(session, userIndex, measuring);
      default:
        throw new RangeError('unknown OIDC load-test action');
    }
  }

  return Object.freeze({
    login: (userIndex, measuring) => login(userIndex, measuring),
    introspect,
    userinfo,
    refresh,
    discovery,
    jwks,
    revokeAndRelogin,
    execute,
  });
}
