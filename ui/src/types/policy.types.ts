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
}

export interface TenantRefreshTokenPolicy {
  ttlSec: number;
  rotationEnabled: boolean;
  reuseAction: 'revoke_grant';
}

export interface SignupInvitePolicy {
  mode: 'invite' | 'open';
  allowedEmailDomains: string[];
}

export interface TenantPolicyResponse {
  password: PasswordPolicy;
  mfa: TenantMfaPolicy;
  allowedIdp: AllowedIdpPolicy;
  session: TenantSessionPolicy;
  refreshToken: TenantRefreshTokenPolicy;
  signup: SignupInvitePolicy;
}

export type UpdateTenantPoliciesDto = Partial<{
  password: Partial<PasswordPolicy>;
  mfa: Partial<TenantMfaPolicy>;
  allowedIdp: Partial<AllowedIdpPolicy>;
  session: Partial<TenantSessionPolicy>;
  refreshToken: Partial<TenantRefreshTokenPolicy>;
  signup: Partial<SignupInvitePolicy>;
}>;
