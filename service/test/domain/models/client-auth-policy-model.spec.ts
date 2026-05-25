import { ClientAuthPolicyModel } from '@domain/models/client-auth-policy';
import type {
  AuthMethod,
  ClientLoginSessionModeOverride,
  MfaMethod,
  RefreshTokenReuseAction,
} from '@domain/models/client-auth-policy';
import type { SessionConflictAction } from '@domain/models/tenant-policy';

function makePolicy(
  overrides: Partial<{
    allowedAuthMethods: AuthMethod[];
    defaultAcr: string;
    mfaRequired: boolean;
    allowedMfaMethods: MfaMethod[];
    maxSessionDurationSec: number | null;
    consentRequired: boolean;
    requireAuthTime: boolean;
    allowedIdpProviderKeys: string[] | null;
    reauthenticationIntervalSec: number | null;
    refreshTokenRotationEnabled: boolean;
    refreshTokenReuseAction: RefreshTokenReuseAction;
    loginSessionMode: ClientLoginSessionModeOverride;
    maxConcurrentSessions: number | null;
    sessionConflictAction: SessionConflictAction | null;
  }> = {},
): ClientAuthPolicyModel {
  return new ClientAuthPolicyModel({
    tenantId: 'tenant-1',
    clientRefId: 'client-1',
    allowedAuthMethods: overrides.allowedAuthMethods ?? ['password'],
    defaultAcr: overrides.defaultAcr ?? 'urn:auth:pwd',
    mfaRequired: overrides.mfaRequired ?? false,
    allowedMfaMethods: overrides.allowedMfaMethods ?? ['totp'],
    maxSessionDurationSec: overrides.maxSessionDurationSec ?? null,
    consentRequired: overrides.consentRequired ?? true,
    requireAuthTime: overrides.requireAuthTime ?? false,
    allowedIdpProviderKeys: overrides.allowedIdpProviderKeys ?? null,
    reauthenticationIntervalSec: overrides.reauthenticationIntervalSec ?? null,
    refreshTokenRotationEnabled: overrides.refreshTokenRotationEnabled ?? true,
    refreshTokenReuseAction:
      overrides.refreshTokenReuseAction ?? 'revoke_grant',
    loginSessionMode: overrides.loginSessionMode ?? null,
    maxConcurrentSessions: overrides.maxConcurrentSessions ?? null,
    sessionConflictAction: overrides.sessionConflictAction ?? null,
  });
}

describe('ClientAuthPolicyModel', () => {
  it('기본 속성으로 정책을 생성한다', () => {
    const policy = makePolicy();

    expect(policy.tenantId).toBe('tenant-1');
    expect(policy.clientRefId).toBe('client-1');
    expect(policy.allowedAuthMethods).toEqual(['password']);
    expect(policy.defaultAcr).toBe('urn:auth:pwd');
    expect(policy.mfaRequired).toBe(false);
    expect(policy.allowedMfaMethods).toEqual(['totp']);
    expect(policy.maxSessionDurationSec).toBeNull();
    expect(policy.consentRequired).toBe(true);
    expect(policy.requireAuthTime).toBe(false);
    expect(policy.allowedIdpProviderKeys).toBeNull();
    expect(policy.reauthenticationIntervalSec).toBeNull();
    expect(policy.refreshTokenRotationEnabled).toBe(true);
    expect(policy.refreshTokenReuseAction).toBe('revoke_grant');
    expect(policy.loginSessionMode).toBeNull();
    expect(policy.maxConcurrentSessions).toBeNull();
    expect(policy.sessionConflictAction).toBeNull();
  });

  it('id를 지정하여 생성할 수 있다', () => {
    const policy = new ClientAuthPolicyModel(
      {
        tenantId: 'tenant-1',
        clientRefId: 'client-1',
        allowedAuthMethods: ['password'],
        defaultAcr: 'urn:auth:pwd',
        mfaRequired: false,
        allowedMfaMethods: ['totp'],
        maxSessionDurationSec: null,
        consentRequired: true,
        requireAuthTime: false,
        allowedIdpProviderKeys: null,
        reauthenticationIntervalSec: null,
        refreshTokenRotationEnabled: true,
        refreshTokenReuseAction: 'revoke_grant',
        loginSessionMode: null,
        maxConcurrentSessions: null,
        sessionConflictAction: null,
      },
      'policy-1',
    );

    expect(policy.id).toBe('policy-1');
  });

  it('setPersistence로 영속성 메타데이터를 설정한다', () => {
    const policy = makePolicy();
    const now = new Date();

    policy.setPersistence('policy-1', now, now);

    expect(policy.id).toBe('policy-1');
    expect(policy.createdAt).toBe(now);
    expect(policy.updatedAt).toBe(now);
  });

  describe('change methods', () => {
    it('changeAllowedAuthMethods로 인증 방식을 변경한다', () => {
      const policy = makePolicy();

      policy.changeAllowedAuthMethods(['password', 'webauthn']);

      expect(policy.allowedAuthMethods).toEqual(['password', 'webauthn']);
    });

    it('changeDefaultAcr로 기본 ACR을 변경한다', () => {
      const policy = makePolicy();

      policy.changeDefaultAcr('urn:auth:mfa');

      expect(policy.defaultAcr).toBe('urn:auth:mfa');
    });

    it('changeMfaRequired로 MFA 필수 여부를 변경한다', () => {
      const policy = makePolicy();

      policy.changeMfaRequired(true);

      expect(policy.mfaRequired).toBe(true);
    });

    it('changeAllowedMfaMethods로 MFA 방식을 변경한다', () => {
      const policy = makePolicy();

      policy.changeAllowedMfaMethods(['totp', 'webauthn', 'recovery_code']);

      expect(policy.allowedMfaMethods).toEqual([
        'totp',
        'webauthn',
        'recovery_code',
      ]);
    });

    it('changeMaxSessionDurationSec로 세션 시간을 변경한다', () => {
      const policy = makePolicy();

      policy.changeMaxSessionDurationSec(3600);

      expect(policy.maxSessionDurationSec).toBe(3600);
    });

    it('changeMaxSessionDurationSec에 null을 설정하면 기본값 사용으로 돌아간다', () => {
      const policy = makePolicy({ maxSessionDurationSec: 3600 });

      policy.changeMaxSessionDurationSec(null);

      expect(policy.maxSessionDurationSec).toBeNull();
    });

    it('changeConsentRequired로 동의 화면 필수 여부를 변경한다', () => {
      const policy = makePolicy();

      policy.changeConsentRequired(false);

      expect(policy.consentRequired).toBe(false);
    });

    it('changeRequireAuthTime으로 auth_time 필수 여부를 변경한다', () => {
      const policy = makePolicy();

      policy.changeRequireAuthTime(true);

      expect(policy.requireAuthTime).toBe(true);
    });

    it('changeAllowedIdpProviderKeys로 client IdP override를 변경한다', () => {
      const policy = makePolicy();

      policy.changeAllowedIdpProviderKeys(['google', 'okta']);

      expect(policy.allowedIdpProviderKeys).toEqual(['google', 'okta']);
    });

    it('changeReauthenticationIntervalSec로 재인증 interval을 변경한다', () => {
      const policy = makePolicy();

      policy.changeReauthenticationIntervalSec(1800);

      expect(policy.reauthenticationIntervalSec).toBe(1800);
    });

    it('changeRefreshTokenRotationEnabled로 rotation 여부를 변경한다', () => {
      const policy = makePolicy();

      policy.changeRefreshTokenRotationEnabled(false);

      expect(policy.refreshTokenRotationEnabled).toBe(false);
    });

    it('changeRefreshTokenReuseAction으로 재사용 대응 정책을 변경한다', () => {
      const policy = makePolicy();

      policy.changeRefreshTokenReuseAction('revoke_grant');

      expect(policy.refreshTokenReuseAction).toBe('revoke_grant');
    });

    it('changeLoginSessionMode로 single login override를 변경한다', () => {
      const policy = makePolicy();

      policy.changeLoginSessionMode('single');

      expect(policy.loginSessionMode).toBe('single');
    });

    it('changeMaxConcurrentSessions로 동시 세션 제한을 변경한다', () => {
      const policy = makePolicy();

      policy.changeMaxConcurrentSessions(1);

      expect(policy.maxConcurrentSessions).toBe(1);
    });

    it('changeSessionConflictAction으로 세션 충돌 정책을 변경한다', () => {
      const policy = makePolicy();

      policy.changeSessionConflictAction('deny_new_login');

      expect(policy.sessionConflictAction).toBe('deny_new_login');
    });
  });

  it('tenant 기본 정책과 client override를 결합해 effective policy를 계산한다', () => {
    const policy = makePolicy({
      mfaRequired: true,
      allowedIdpProviderKeys: ['okta'],
      maxSessionDurationSec: 1800,
      requireAuthTime: false,
      reauthenticationIntervalSec: 900,
    });

    const effective = policy.resolveEffectivePolicy(
      {
        password: {
          minLength: 12,
          requireUppercase: true,
          requireLowercase: true,
          requireNumber: true,
          requireSymbol: true,
          preventReuseCount: 5,
          expiresInDays: 90,
          lockoutFailureThreshold: 5,
          lockoutDurationSec: 900,
        },
        mfa: { required: false, adminRequired: true },
        allowedIdp: { providerKeys: ['google'] },
        session: {
          maxAgeSec: 3600,
          requireAuthTime: true,
          reauthenticationIntervalSec: 1200,
          loginSessionMode: 'multi',
          maxConcurrentSessions: 3,
          sessionConflictAction: 'revoke_previous_sessions',
        },
        refreshToken: {
          ttlSec: 86400,
          rotationEnabled: true,
          reuseAction: 'revoke_grant',
        },
        signup: { mode: 'invite', allowedEmailDomains: [] },
      },
      7200,
    );

    expect(effective).toEqual({
      mfaRequired: true,
      allowedIdpProviderKeys: ['okta'],
      maxSessionDurationSec: 1800,
      requireAuthTime: true,
      reauthenticationIntervalSec: 900,
      refreshTokenTtlSec: 7200,
      loginSessionMode: 'multi',
      maxConcurrentSessions: 3,
      sessionConflictAction: 'revoke_previous_sessions',
    });
  });

  it('client single login override와 더 작은 동시 세션 제한을 effective policy에 반영한다', () => {
    const policy = makePolicy({
      loginSessionMode: 'single',
      maxConcurrentSessions: 1,
      sessionConflictAction: 'deny_new_login',
    });

    const effective = policy.resolveEffectivePolicy(
      {
        password: {
          minLength: 12,
          requireUppercase: true,
          requireLowercase: true,
          requireNumber: true,
          requireSymbol: true,
          preventReuseCount: 5,
          expiresInDays: 90,
          lockoutFailureThreshold: 5,
          lockoutDurationSec: 900,
        },
        mfa: { required: false, adminRequired: true },
        allowedIdp: { providerKeys: null },
        session: {
          maxAgeSec: 3600,
          requireAuthTime: false,
          reauthenticationIntervalSec: null,
          loginSessionMode: 'multi',
          maxConcurrentSessions: 5,
          sessionConflictAction: 'revoke_previous_sessions',
        },
        refreshToken: {
          ttlSec: 86400,
          rotationEnabled: true,
          reuseAction: 'revoke_grant',
        },
        signup: { mode: 'invite', allowedEmailDomains: [] },
      },
      null,
    );

    expect(effective.loginSessionMode).toBe('single');
    expect(effective.maxConcurrentSessions).toBe(1);
    expect(effective.sessionConflictAction).toBe('deny_new_login');
  });
});
