import type {
  CreateTenantDto,
  TenantResponse,
  UpdateTenantDto,
} from '@/types/tenant.types';
import type {
  TenantPolicyResponse,
  UpdateTenantPoliciesDto,
} from '@/types/policy.types';

export interface TenantPolicyFormValues {
  passwordMinLength?: number;
  passwordRequireUppercase?: boolean;
  passwordRequireLowercase?: boolean;
  passwordRequireNumber?: boolean;
  passwordRequireSymbol?: boolean;
  passwordPreventReuseCount?: number;
  passwordExpiresInDays?: number | null;
  lockoutFailureThreshold?: number;
  lockoutDurationSec?: number;
  mfaRequired?: boolean;
  adminMfaRequired?: boolean;
  allowedIdpProviderKeys?: string[];
  sessionMaxAgeSec?: number | null;
  sessionRequireAuthTime?: boolean;
  reauthenticationIntervalSec?: number | null;
  loginSessionMode?: 'multi' | 'single';
  maxConcurrentSessions?: number | null;
  sessionConflictAction?:
    | 'deny_new_login'
    | 'revoke_previous_sessions'
    | 'revoke_oldest_session';
  refreshTokenTtlSec?: number;
  refreshTokenRotationEnabled?: boolean;
  allowedEmailDomains?: string[];
}

export type TenantFormValues = (CreateTenantDto | UpdateTenantDto) &
  TenantPolicyFormValues;

export function tenantResponseToFormValues(
  tenant: TenantResponse,
  policies?: TenantPolicyResponse,
): Partial<TenantFormValues> {
  const signupPolicy =
    tenant.signupPolicy === 'invite' || tenant.signupPolicy === 'open'
      ? tenant.signupPolicy
      : 'invite';

  return {
    name: tenant.name,
    brandName: tenant.brandName ?? undefined,
    signupPolicy: policies?.signup.mode ?? signupPolicy,
    requirePhoneVerify: tenant.requirePhoneVerify,
    passwordMinLength: policies?.password.minLength,
    passwordRequireUppercase: policies?.password.requireUppercase,
    passwordRequireLowercase: policies?.password.requireLowercase,
    passwordRequireNumber: policies?.password.requireNumber,
    passwordRequireSymbol: policies?.password.requireSymbol,
    passwordPreventReuseCount: policies?.password.preventReuseCount,
    passwordExpiresInDays: policies?.password.expiresInDays,
    lockoutFailureThreshold: policies?.password.lockoutFailureThreshold,
    lockoutDurationSec: policies?.password.lockoutDurationSec,
    mfaRequired: policies?.mfa.required,
    adminMfaRequired: policies?.mfa.adminRequired,
    allowedIdpProviderKeys: policies?.allowedIdp.providerKeys ?? [],
    sessionMaxAgeSec: policies?.session.maxAgeSec,
    sessionRequireAuthTime: policies?.session.requireAuthTime,
    reauthenticationIntervalSec: policies?.session.reauthenticationIntervalSec,
    loginSessionMode: policies?.session.loginSessionMode,
    maxConcurrentSessions: policies?.session.maxConcurrentSessions,
    sessionConflictAction: policies?.session.sessionConflictAction,
    refreshTokenTtlSec: policies?.refreshToken.ttlSec,
    refreshTokenRotationEnabled: policies?.refreshToken.rotationEnabled,
    allowedEmailDomains: policies?.signup.allowedEmailDomains ?? [],
  };
}

export function toTenantUpdateDto(values: TenantFormValues): UpdateTenantDto {
  return {
    name: values.name,
    brandName: values.brandName,
    signupPolicy: values.signupPolicy,
    requirePhoneVerify: values.requirePhoneVerify,
  };
}

export function toTenantPolicyDto(
  values: TenantFormValues,
): UpdateTenantPoliciesDto {
  return {
    password: {
      minLength: values.passwordMinLength,
      requireUppercase: values.passwordRequireUppercase,
      requireLowercase: values.passwordRequireLowercase,
      requireNumber: values.passwordRequireNumber,
      requireSymbol: values.passwordRequireSymbol,
      preventReuseCount: values.passwordPreventReuseCount,
      expiresInDays: values.passwordExpiresInDays ?? null,
      lockoutFailureThreshold: values.lockoutFailureThreshold,
      lockoutDurationSec: values.lockoutDurationSec,
    },
    mfa: {
      required: values.mfaRequired,
      adminRequired: values.adminMfaRequired,
    },
    allowedIdp: {
      providerKeys:
        values.allowedIdpProviderKeys &&
        values.allowedIdpProviderKeys.length > 0
          ? values.allowedIdpProviderKeys
          : null,
    },
    session: {
      maxAgeSec: values.sessionMaxAgeSec ?? null,
      requireAuthTime: values.sessionRequireAuthTime,
      reauthenticationIntervalSec: values.reauthenticationIntervalSec ?? null,
      loginSessionMode: values.loginSessionMode,
      maxConcurrentSessions: values.maxConcurrentSessions ?? null,
      sessionConflictAction: values.sessionConflictAction,
    },
    refreshToken: {
      ttlSec: values.refreshTokenTtlSec,
      rotationEnabled: values.refreshTokenRotationEnabled,
      reuseAction: 'revoke_grant',
    },
    signup: {
      mode: values.signupPolicy,
      allowedEmailDomains: values.allowedEmailDomains ?? [],
    },
  };
}
