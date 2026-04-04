import { ClientAuthPolicyModel } from '@domain/models/client-auth-policy';
import type { AuthMethod, MfaMethod } from '@domain/models/client-auth-policy';

function makePolicy(
  overrides: Partial<{
    allowedAuthMethods: AuthMethod[];
    defaultAcr: string;
    mfaRequired: boolean;
    allowedMfaMethods: MfaMethod[];
    maxSessionDurationSec: number | null;
    consentRequired: boolean;
    requireAuthTime: boolean;
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
  });
});
