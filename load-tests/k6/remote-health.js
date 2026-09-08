import { check } from 'k6';
import http from 'k6/http';
import { loadTlsOptions } from './tls.js';

export const options = {
  ...loadTlsOptions(__ENV),
  vus: 1,
  iterations: 1,
  thresholds: { checks: ['rate==1'] },
};

export default function () {
  const response = http.get(`${__ENV.BASE_URL}/health`, {
    redirects: 0,
    responseType: 'none',
    tags: { endpoint: 'remote-mtls-health' },
    timeout: '10s',
  });
  check(response, {
    'remote mTLS health accepted': (result) => result.status === 200,
  });
}
