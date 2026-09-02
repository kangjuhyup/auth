import http from 'k6/http';
import { check } from 'k6';
import exec from 'k6/execution';
import { loadConfig } from './config.js';
import { SAFE_SYSTEM_TAGS } from './system-tags.js';
import {
  offlineAccessScopePayload,
  publicClientPayload,
  serviceClientPayload,
  signupPayload,
  tenantPayload,
} from './payloads.js';

const config = loadConfig(__ENV);
const jsonHeaders = { 'Content-Type': 'application/json' };

export const options = {
  systemTags: SAFE_SYSTEM_TAGS,
  scenarios: {
    provisionUsers: {
      executor: 'shared-iterations',
      iterations: config.maxVus,
      vus: Math.min(config.maxVus, 25),
      maxDuration: '30m',
    },
  },
  thresholds: {
    checks: ['rate==1'],
  },
};

function requireCreated(response, operation) {
  const created = check(response, {
    [operation]: (result) => result.status === 201,
  });
  if (!created) {
    throw new Error(`${operation} failed with status ${response.status}`);
  }
}

function postWithAdminSession(path, payload, adminSession, operation) {
  const response = http.post(
    `${config.baseUrl}${path}`,
    JSON.stringify(payload),
    {
      headers: { ...jsonHeaders, Authorization: `Bearer ${adminSession}` },
      tags: { endpoint: operation },
      responseType: 'none',
    },
  );
  requireCreated(response, operation);
}

export function setup() {
  const loginResponse = http.post(
    `${config.baseUrl}/admin/session`,
    JSON.stringify({
      username: config.adminUsername,
      password: config.adminPassword,
    }),
    {
      headers: jsonHeaders,
      tags: { endpoint: 'provision-admin-session' },
      responseType: 'none',
    },
  );
  requireCreated(loginResponse, 'admin session provisioned');

  const adminSession = loginResponse.cookies.admin_session?.[0]?.value;
  if (!adminSession) {
    throw new Error('admin session cookie was not issued');
  }

  postWithAdminSession(
    '/admin/tenants',
    tenantPayload(),
    adminSession,
    'tenant provisioned',
  );
  postWithAdminSession(
    `/t/${config.tenantCode}/admin/scopes`,
    offlineAccessScopePayload(),
    adminSession,
    'offline access scope provisioned',
  );
  postWithAdminSession(
    `/t/${config.tenantCode}/admin/clients`,
    publicClientPayload(config),
    adminSession,
    'public client provisioned',
  );
  postWithAdminSession(
    `/t/${config.tenantCode}/admin/clients`,
    serviceClientPayload(config),
    adminSession,
    'service client provisioned',
  );
}

export default function () {
  const index = exec.scenario.iterationInTest + 1;
  const response = http.post(
    `${config.baseUrl}/auth/signup?tenantCode=${config.tenantCode}`,
    JSON.stringify(signupPayload(index, config)),
    {
      headers: jsonHeaders,
      tags: { endpoint: 'provision-user' },
      responseType: 'none',
    },
  );
  check(response, { 'user provisioned': (result) => result.status === 201 });
}
