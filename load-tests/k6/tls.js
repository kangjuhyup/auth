/* global open */

const REMOTE_BASE_URL = 'https://auth-service:13443';
const CLIENT_CERTIFICATE_PATH = '/certs/client.crt';
const CLIENT_KEY_PATH = '/certs/client.key';

const LOCAL_TLS_OPTIONS = Object.freeze({});

export function loadTlsOptions(env, readFile = open) {
  if (env.REMOTE_MTLS !== 'true') return LOCAL_TLS_OPTIONS;
  if (env.BASE_URL !== REMOTE_BASE_URL) {
    throw new Error(`remote mTLS BASE_URL must be exactly ${REMOTE_BASE_URL}`);
  }

  const domains = Object.freeze(['auth-service']);
  const identity = Object.freeze({
    domains,
    cert: readFile(CLIENT_CERTIFICATE_PATH),
    key: readFile(CLIENT_KEY_PATH),
  });

  return Object.freeze({
    tlsAuth: Object.freeze([identity]),
    tlsVersion: Object.freeze({
      min: 'tls1.2',
      max: 'tls1.3',
    }),
  });
}
