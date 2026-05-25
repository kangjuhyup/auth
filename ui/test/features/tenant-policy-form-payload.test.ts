import { describe, expect, it } from 'vitest';
import {
  tenantResponseToFormValues,
  toTenantPolicyDto,
  toTenantUpdateDto,
} from '@/features/tenants/tenantPolicyFormPayload';
import type { TenantPolicyResponse } from '@/types/policy.types';

const policies: TenantPolicyResponse = {
  password: {
    minLength: 14,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSymbol: false,
    preventReuseCount: 5,
    expiresInDays: null,
    lockoutFailureThreshold: 8,
    lockoutDurationSec: 900,
  },
  mfa: {
    required: true,
    adminRequired: true,
  },
  allowedIdp: {
    providerKeys: ['google', 'saml-main'],
  },
  session: {
    maxAgeSec: 28800,
    requireAuthTime: true,
    reauthenticationIntervalSec: null,
  },
  refreshToken: {
    ttlSec: 2592000,
    rotationEnabled: true,
    reuseAction: 'revoke_grant',
  },
  signup: {
    mode: 'invite',
    allowedEmailDomains: ['example.com'],
  },
};

describe('tenant policy form payload', () => {
  it('tenant 응답과 정책 응답을 tenant 수정 form 값으로 합친다', () => {
    const values = tenantResponseToFormValues(
      {
        id: 'tenant-1',
        code: 'acme',
        name: 'ACME',
        signupPolicy: 'open',
        requirePhoneVerify: true,
        brandName: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      },
      policies,
    );

    expect(values).toMatchObject({
      name: 'ACME',
      brandName: undefined,
      signupPolicy: 'invite',
      requirePhoneVerify: true,
      passwordMinLength: 14,
      mfaRequired: true,
      adminMfaRequired: true,
      allowedIdpProviderKeys: ['google', 'saml-main'],
      sessionMaxAgeSec: 28800,
      sessionRequireAuthTime: true,
      reauthenticationIntervalSec: null,
      refreshTokenTtlSec: 2592000,
      refreshTokenRotationEnabled: true,
      allowedEmailDomains: ['example.com'],
    });
  });

  it('tenant 수정 payload와 정책 payload를 분리한다', () => {
    const formValues = {
      name: 'ACME Korea',
      brandName: 'ACME',
      signupPolicy: 'open' as const,
      requirePhoneVerify: false,
      passwordMinLength: 12,
      passwordRequireUppercase: true,
      passwordRequireLowercase: true,
      passwordRequireNumber: true,
      passwordRequireSymbol: true,
      passwordPreventReuseCount: 3,
      passwordExpiresInDays: null,
      lockoutFailureThreshold: 5,
      lockoutDurationSec: 600,
      mfaRequired: true,
      adminMfaRequired: false,
      allowedIdpProviderKeys: [],
      sessionMaxAgeSec: null,
      sessionRequireAuthTime: false,
      reauthenticationIntervalSec: 3600,
      refreshTokenTtlSec: 1209600,
      refreshTokenRotationEnabled: true,
      allowedEmailDomains: ['acme.test'],
    };

    expect(toTenantUpdateDto(formValues)).toEqual({
      name: 'ACME Korea',
      brandName: 'ACME',
      signupPolicy: 'open',
      requirePhoneVerify: false,
    });

    expect(toTenantPolicyDto(formValues)).toEqual({
      password: {
        minLength: 12,
        requireUppercase: true,
        requireLowercase: true,
        requireNumber: true,
        requireSymbol: true,
        preventReuseCount: 3,
        expiresInDays: null,
        lockoutFailureThreshold: 5,
        lockoutDurationSec: 600,
      },
      mfa: {
        required: true,
        adminRequired: false,
      },
      allowedIdp: {
        providerKeys: null,
      },
      session: {
        maxAgeSec: null,
        requireAuthTime: false,
        reauthenticationIntervalSec: 3600,
      },
      refreshToken: {
        ttlSec: 1209600,
        rotationEnabled: true,
        reuseAction: 'revoke_grant',
      },
      signup: {
        mode: 'open',
        allowedEmailDomains: ['acme.test'],
      },
    });
  });
});
