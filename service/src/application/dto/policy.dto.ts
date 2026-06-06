import type { TenantPolicyInput, TenantPolicySet } from '@domain/models';

export class UpdateTenantPoliciesDto {
  private constructor(
    public readonly password?: TenantPolicyInput['password'],
    public readonly mfa?: TenantPolicyInput['mfa'],
    public readonly allowedIdp?: TenantPolicyInput['allowedIdp'],
    public readonly session?: TenantPolicyInput['session'],
    public readonly refreshToken?: TenantPolicyInput['refreshToken'],
    public readonly signup?: TenantPolicyInput['signup'],
  ) {}

  static of(params: TenantPolicyInput): UpdateTenantPoliciesDto {
    return new UpdateTenantPoliciesDto(
      params.password,
      params.mfa,
      params.allowedIdp,
      params.session,
      params.refreshToken,
      params.signup,
    );
  }
}

export class TenantPolicyResponse {
  private constructor(
    public readonly password: TenantPolicySet['password'],
    public readonly mfa: TenantPolicySet['mfa'],
    public readonly allowedIdp: TenantPolicySet['allowedIdp'],
    public readonly session: TenantPolicySet['session'],
    public readonly refreshToken: TenantPolicySet['refreshToken'],
    public readonly signup: TenantPolicySet['signup'],
  ) {}

  static of(params: TenantPolicySet): TenantPolicyResponse {
    return new TenantPolicyResponse(
      params.password,
      params.mfa,
      params.allowedIdp,
      params.session,
      params.refreshToken,
      params.signup,
    );
  }
}
