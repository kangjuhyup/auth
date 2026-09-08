import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const healthModuleUrl = new URL('../k6/remote-health.js', import.meta.url);

test('remote health performs exactly one bounded mTLS health check', async () => {
  const calls = [];
  const checks = [];
  const tlsOptions = {
    tlsAuth: [{ domains: ['auth-service'], cert: 'cert', key: 'key' }],
  };
  globalThis.__remoteHealthHttp = {
    get(url, options) {
      calls.push({ url, options });
      return { status: 200 };
    },
  };
  globalThis.__remoteHealthCheck = (response, predicates) => {
    checks.push({ response, predicates });
  };
  globalThis.__remoteHealthLoadTlsOptions = (environment) => {
    assert.equal(environment, globalThis.__ENV);
    return tlsOptions;
  };
  globalThis.__ENV = { BASE_URL: 'https://auth-service:13443' };

  try {
    const source = readFileSync(healthModuleUrl, 'utf8')
      .replace(
        "import { check } from 'k6';",
        'const check = globalThis.__remoteHealthCheck;',
      )
      .replace(
        "import http from 'k6/http';",
        'const http = globalThis.__remoteHealthHttp;',
      )
      .replace(
        "import { loadTlsOptions } from './tls.js';",
        'const loadTlsOptions = globalThis.__remoteHealthLoadTlsOptions;',
      );
    const module = await import(
      `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
    );

    assert.deepEqual(module.options, {
      ...tlsOptions,
      vus: 1,
      iterations: 1,
      thresholds: { checks: ['rate==1'] },
    });

    module.default();
    assert.deepEqual(calls, [
      {
        url: 'https://auth-service:13443/health',
        options: {
          redirects: 0,
          responseType: 'none',
          tags: { endpoint: 'remote-mtls-health' },
          timeout: '10s',
        },
      },
    ]);
    assert.equal(checks.length, 1);
    assert.equal(
      checks[0].predicates['remote mTLS health accepted']({ status: 200 }),
      true,
    );
    assert.equal(
      checks[0].predicates['remote mTLS health accepted']({ status: 503 }),
      false,
    );
  } finally {
    delete globalThis.__remoteHealthHttp;
    delete globalThis.__remoteHealthCheck;
    delete globalThis.__remoteHealthLoadTlsOptions;
    delete globalThis.__ENV;
  }
});
