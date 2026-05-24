import { TenantConfigModel } from '@domain/models/tenant-config';

function makeConfig(): TenantConfigModel {
  return new TenantConfigModel({
    tenantId: 'tenant-1',
    signupPolicy: 'open',
    requirePhoneVerify: false,
    brandName: 'Acme',
    accessTokenTtlSec: 3600,
    refreshTokenTtlSec: 86400,
    extra: null,
  });
}

describe('TenantConfigModel', () => {
  it('컬럼 기본값을 반영한 tenant policy set을 반환한다', () => {
    const config = makeConfig();

    const policies = config.getPolicies();

    expect(policies.signup.mode).toBe('open');
    expect(policies.refreshToken.ttlSec).toBe(86400);
    expect(policies.password.minLength).toBe(12);
    expect(policies.mfa.adminRequired).toBe(true);
  });

  it('정책 업데이트 시 기존 정책에 patch를 병합하고 컬럼 정책도 동기화한다', () => {
    const config = makeConfig();

    config.updatePolicies({
      password: { minLength: 14, preventReuseCount: 10 },
      mfa: { required: true },
      allowedIdp: { providerKeys: ['google', 'okta'] },
      session: {
        maxAgeSec: 7200,
        requireAuthTime: true,
        reauthenticationIntervalSec: 1800,
      },
      refreshToken: { ttlSec: 604800 },
      signup: {
        mode: 'invite',
        allowedEmailDomains: ['example.com'],
      },
    });

    const policies = config.getPolicies();
    expect(policies.password.minLength).toBe(14);
    expect(policies.password.preventReuseCount).toBe(10);
    expect(policies.password.requireSymbol).toBe(true);
    expect(policies.mfa.required).toBe(true);
    expect(policies.allowedIdp.providerKeys).toEqual(['google', 'okta']);
    expect(policies.session.maxAgeSec).toBe(7200);
    expect(policies.session.requireAuthTime).toBe(true);
    expect(policies.session.reauthenticationIntervalSec).toBe(1800);
    expect(policies.refreshToken.ttlSec).toBe(604800);
    expect(policies.signup.mode).toBe('invite');
    expect(policies.signup.allowedEmailDomains).toEqual(['example.com']);
    expect(config.signupPolicy).toBe('invite');
    expect(config.refreshTokenTtlSec).toBe(604800);
  });
});
