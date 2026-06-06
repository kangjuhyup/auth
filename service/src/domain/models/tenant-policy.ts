export type RefreshTokenReuseAction = 'revoke_grant';
export type SignupMode = 'invite' | 'open';
export type LoginSessionMode = 'multi' | 'single';
export type SessionConflictAction =
  | 'deny_new_login'
  | 'revoke_previous_sessions'
  | 'revoke_oldest_session';

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSymbol: boolean;
  preventReuseCount: number;
  expiresInDays: number | null;
  lockoutFailureThreshold: number;
  lockoutDurationSec: number;
}

export interface TenantMfaPolicy {
  required: boolean;
  adminRequired: boolean;
}

export interface AllowedIdpPolicy {
  providerKeys: string[] | null;
}

export interface TenantSessionPolicy {
  maxAgeSec: number | null;
  requireAuthTime: boolean;
  reauthenticationIntervalSec: number | null;
  loginSessionMode: LoginSessionMode;
  maxConcurrentSessions: number | null;
  sessionConflictAction: SessionConflictAction;
}

export interface TenantRefreshTokenPolicy {
  ttlSec: number;
  rotationEnabled: boolean;
  reuseAction: RefreshTokenReuseAction;
}

export interface SignupInvitePolicy {
  mode: SignupMode;
  allowedEmailDomains: string[];
}

export interface TenantPolicySet {
  password: PasswordPolicy;
  mfa: TenantMfaPolicy;
  allowedIdp: AllowedIdpPolicy;
  session: TenantSessionPolicy;
  refreshToken: TenantRefreshTokenPolicy;
  signup: SignupInvitePolicy;
}

export type TenantPolicyInput = Partial<{
  password: Partial<PasswordPolicy>;
  mfa: Partial<TenantMfaPolicy>;
  allowedIdp: Partial<AllowedIdpPolicy>;
  session: Partial<TenantSessionPolicy>;
  refreshToken: Partial<TenantRefreshTokenPolicy>;
  signup: Partial<SignupInvitePolicy>;
}>;

export const DEFAULT_TENANT_POLICY_SET: TenantPolicySet = {
  password: {
    minLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSymbol: true,
    preventReuseCount: 5,
    expiresInDays: 90,
    lockoutFailureThreshold: 5,
    lockoutDurationSec: 15 * 60,
  },
  mfa: {
    required: false,
    adminRequired: true,
  },
  allowedIdp: {
    providerKeys: null,
  },
  session: {
    maxAgeSec: 8 * 60 * 60,
    requireAuthTime: false,
    reauthenticationIntervalSec: null,
    loginSessionMode: 'multi',
    maxConcurrentSessions: null,
    sessionConflictAction: 'revoke_previous_sessions',
  },
  refreshToken: {
    ttlSec: 14 * 24 * 60 * 60,
    rotationEnabled: true,
    reuseAction: 'revoke_grant',
  },
  signup: {
    mode: 'invite',
    allowedEmailDomains: [],
  },
};

export function normalizeTenantPolicySet(
  storedPolicies?: Record<string, unknown> | null,
  defaults: Partial<{
    signupMode: SignupMode;
    refreshTokenTtlSec: number;
  }> = {},
): TenantPolicySet {
  const base = clonePolicySet(DEFAULT_TENANT_POLICY_SET);
  base.signup.mode = defaults.signupMode ?? base.signup.mode;
  base.refreshToken.ttlSec =
    defaults.refreshTokenTtlSec ?? base.refreshToken.ttlSec;

  const input = isRecord(storedPolicies) ? storedPolicies : {};

  return {
    password: {
      minLength: intFrom(input.password, 'minLength', base.password.minLength),
      requireUppercase: boolFrom(
        input.password,
        'requireUppercase',
        base.password.requireUppercase,
      ),
      requireLowercase: boolFrom(
        input.password,
        'requireLowercase',
        base.password.requireLowercase,
      ),
      requireNumber: boolFrom(
        input.password,
        'requireNumber',
        base.password.requireNumber,
      ),
      requireSymbol: boolFrom(
        input.password,
        'requireSymbol',
        base.password.requireSymbol,
      ),
      preventReuseCount: intFrom(
        input.password,
        'preventReuseCount',
        base.password.preventReuseCount,
      ),
      expiresInDays: nullableIntFrom(
        input.password,
        'expiresInDays',
        base.password.expiresInDays,
      ),
      lockoutFailureThreshold: intFrom(
        input.password,
        'lockoutFailureThreshold',
        base.password.lockoutFailureThreshold,
      ),
      lockoutDurationSec: intFrom(
        input.password,
        'lockoutDurationSec',
        base.password.lockoutDurationSec,
      ),
    },
    mfa: {
      required: boolFrom(input.mfa, 'required', base.mfa.required),
      adminRequired: boolFrom(
        input.mfa,
        'adminRequired',
        base.mfa.adminRequired,
      ),
    },
    allowedIdp: {
      providerKeys: nullableStringArrayFrom(
        input.allowedIdp,
        'providerKeys',
        base.allowedIdp.providerKeys,
      ),
    },
    session: {
      maxAgeSec: nullableIntFrom(
        input.session,
        'maxAgeSec',
        base.session.maxAgeSec,
      ),
      requireAuthTime: boolFrom(
        input.session,
        'requireAuthTime',
        base.session.requireAuthTime,
      ),
      reauthenticationIntervalSec: nullableIntFrom(
        input.session,
        'reauthenticationIntervalSec',
        base.session.reauthenticationIntervalSec,
      ),
      loginSessionMode: loginSessionModeFrom(
        input.session,
        'loginSessionMode',
        base.session.loginSessionMode,
      ),
      maxConcurrentSessions: nullableIntFrom(
        input.session,
        'maxConcurrentSessions',
        base.session.maxConcurrentSessions,
      ),
      sessionConflictAction: sessionConflictActionFrom(
        input.session,
        'sessionConflictAction',
        base.session.sessionConflictAction,
      ),
    },
    refreshToken: {
      ttlSec: intFrom(input.refreshToken, 'ttlSec', base.refreshToken.ttlSec),
      rotationEnabled: boolFrom(
        input.refreshToken,
        'rotationEnabled',
        base.refreshToken.rotationEnabled,
      ),
      reuseAction:
        stringFrom(input.refreshToken, 'reuseAction') === 'revoke_grant'
          ? 'revoke_grant'
          : base.refreshToken.reuseAction,
    },
    signup: {
      mode:
        stringFrom(input.signup, 'mode') === 'open' ||
        stringFrom(input.signup, 'mode') === 'invite'
          ? (stringFrom(input.signup, 'mode') as SignupMode)
          : base.signup.mode,
      allowedEmailDomains: stringArrayFrom(
        input.signup,
        'allowedEmailDomains',
        base.signup.allowedEmailDomains,
      ),
    },
  };
}

export function mergeTenantPolicySet(
  current: TenantPolicySet,
  updates: TenantPolicyInput,
): TenantPolicySet {
  return normalizeTenantPolicySet({
    password: { ...current.password, ...(updates.password ?? {}) },
    mfa: { ...current.mfa, ...(updates.mfa ?? {}) },
    allowedIdp: { ...current.allowedIdp, ...(updates.allowedIdp ?? {}) },
    session: { ...current.session, ...(updates.session ?? {}) },
    refreshToken: {
      ...current.refreshToken,
      ...(updates.refreshToken ?? {}),
    },
    signup: { ...current.signup, ...(updates.signup ?? {}) },
  });
}

function clonePolicySet(policy: TenantPolicySet): TenantPolicySet {
  return {
    password: { ...policy.password },
    mfa: { ...policy.mfa },
    allowedIdp: {
      providerKeys: policy.allowedIdp.providerKeys
        ? [...policy.allowedIdp.providerKeys]
        : null,
    },
    session: { ...policy.session },
    refreshToken: { ...policy.refreshToken },
    signup: {
      mode: policy.signup.mode,
      allowedEmailDomains: [...policy.signup.allowedEmailDomains],
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nestedRecord(
  source: unknown,
  key: string,
): Record<string, unknown> | null {
  if (!isRecord(source)) return null;
  const value = source[key];
  return isRecord(value) ? value : null;
}

function intFrom(source: unknown, key: string, fallback: number): number {
  const record = nestedRecord({ value: source }, 'value');
  const value = record?.[key];
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : fallback;
}

function nullableIntFrom(
  source: unknown,
  key: string,
  fallback: number | null,
): number | null {
  const record = nestedRecord({ value: source }, 'value');
  const value = record?.[key];
  if (value === null) return null;
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : fallback;
}

function loginSessionModeFrom(
  source: unknown,
  key: string,
  fallback: LoginSessionMode,
): LoginSessionMode {
  const value = stringFrom(source, key);
  return value === 'multi' || value === 'single' ? value : fallback;
}

function sessionConflictActionFrom(
  source: unknown,
  key: string,
  fallback: SessionConflictAction,
): SessionConflictAction {
  const value = stringFrom(source, key);
  return value === 'deny_new_login' ||
    value === 'revoke_previous_sessions' ||
    value === 'revoke_oldest_session'
    ? value
    : fallback;
}

function boolFrom(source: unknown, key: string, fallback: boolean): boolean {
  const record = nestedRecord({ value: source }, 'value');
  const value = record?.[key];
  return typeof value === 'boolean' ? value : fallback;
}

function stringFrom(source: unknown, key: string): string | null {
  const record = nestedRecord({ value: source }, 'value');
  const value = record?.[key];
  return typeof value === 'string' ? value : null;
}

function stringArrayFrom(
  source: unknown,
  key: string,
  fallback: string[],
): string[] {
  const record = nestedRecord({ value: source }, 'value');
  const value = record?.[key];
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? [...value]
    : [...fallback];
}

function nullableStringArrayFrom(
  source: unknown,
  key: string,
  fallback: string[] | null,
): string[] | null {
  const record = nestedRecord({ value: source }, 'value');
  const value = record?.[key];
  if (value === null) return null;
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? [...value]
    : fallback
      ? [...fallback]
      : null;
}
