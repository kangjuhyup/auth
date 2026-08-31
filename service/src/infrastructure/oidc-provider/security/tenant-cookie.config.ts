import { createHmac } from 'node:crypto';

const TENANT_CODE_PATTERN = /^[a-z0-9-]{1,64}$/;
const COOKIE_KEY_CONTEXT_VERSION = 'oidc-cookie-key:v1';

export function buildTenantCookieConfiguration(
  tenantCode: string,
  sourceKeys: readonly string[],
) {
  if (!TENANT_CODE_PATTERN.test(tenantCode)) {
    throw new Error('Invalid tenant code for OIDC cookies');
  }

  const keys = sourceKeys.map((key) => key.trim()).filter(Boolean);
  if (keys.length === 0) {
    throw new Error('OIDC cookie signing keys are required');
  }

  const path = `/t/${tenantCode}`;
  const context = `${COOKIE_KEY_CONTEXT_VERSION}:${tenantCode}`;

  return {
    names: {
      session: `_session_${tenantCode}`,
      interaction: `_interaction_${tenantCode}`,
      resume: `_interaction_resume_${tenantCode}`,
    },
    long: {
      httpOnly: true,
      sameSite: 'lax' as const,
      path,
    },
    short: {
      httpOnly: true,
      sameSite: 'lax' as const,
      path,
    },
    keys: keys.map((key) =>
      createHmac('sha256', key).update(context).digest('base64url'),
    ),
  };
}
