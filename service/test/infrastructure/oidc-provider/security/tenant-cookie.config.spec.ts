import { buildTenantCookieConfiguration } from '@infrastructure/oidc-provider/security/tenant-cookie.config';

describe('buildTenantCookieConfiguration', () => {
  it('테넌트별 이름과 경로를 사용하고 키를 결정적으로 파생한다', () => {
    const first = buildTenantCookieConfiguration('acme', ['root-key-1']);
    const again = buildTenantCookieConfiguration('acme', ['root-key-1']);
    const otherTenant = buildTenantCookieConfiguration('beta', ['root-key-1']);

    expect(first.names).toEqual({
      session: '_session_acme',
      interaction: '_interaction_acme',
      resume: '_interaction_resume_acme',
    });
    expect(first.long).toMatchObject({ path: '/t/acme' });
    expect(first.short).toMatchObject({ path: '/t/acme' });
    expect(first.keys).toEqual(again.keys);
    expect(first.keys).not.toEqual(['root-key-1']);
    expect(first.keys).not.toEqual(otherTenant.keys);
  });

  it.each(['ACME', 'acme/test', 'acme_test', '', 'a'.repeat(65)])(
    '안전하지 않은 tenant code %p를 거부한다',
    (tenantCode) => {
      expect(() =>
        buildTenantCookieConfiguration(tenantCode, ['root-key']),
      ).toThrow('Invalid tenant code for OIDC cookies');
    },
  );

  it('빈 cookie signing key를 거부한다', () => {
    expect(() => buildTenantCookieConfiguration('acme', [''])).toThrow(
      'OIDC cookie signing keys are required',
    );
  });
});
