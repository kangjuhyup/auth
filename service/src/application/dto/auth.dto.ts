export class SignupDto {
  private constructor(
    public readonly username: string,
    public readonly password: string,
    public readonly email?: string,
    public readonly phone?: string,
  ) {}

  static of(params: {
    username: string;
    password: string;
    email?: string;
    phone?: string;
  }): SignupDto {
    return new SignupDto(
      params.username,
      params.password,
      params.email,
      params.phone,
    );
  }
}

export class WithdrawDto {
  private constructor(public readonly password: string) {}

  static of(params: { password: string }): WithdrawDto {
    return new WithdrawDto(params.password);
  }
}

export class ChangePasswordDto {
  private constructor(
    public readonly currentPassword: string,
    public readonly newPassword: string,
  ) {}

  static of(params: {
    currentPassword: string;
    newPassword: string;
  }): ChangePasswordDto {
    return new ChangePasswordDto(params.currentPassword, params.newPassword);
  }
}

export class PasswordResetRequestDto {
  private constructor(
    public readonly email?: string,
    public readonly phone?: string,
  ) {}

  static of(params: {
    email?: string;
    phone?: string;
  }): PasswordResetRequestDto {
    return new PasswordResetRequestDto(params.email, params.phone);
  }
}

export class PasswordResetDto {
  private constructor(
    public readonly token: string,
    public readonly newPassword: string,
  ) {}

  static of(params: { token: string; newPassword: string }): PasswordResetDto {
    return new PasswordResetDto(params.token, params.newPassword);
  }
}

export class VerificationTokenDto {
  private constructor(public readonly token: string) {}

  static of(params: { token: string }): VerificationTokenDto {
    return new VerificationTokenDto(params.token);
  }
}

export class TotpEnrollmentResponse {
  private constructor(
    public readonly secret: string,
    public readonly otpauthUrl: string,
  ) {}

  static of(params: {
    secret: string;
    otpauthUrl: string;
  }): TotpEnrollmentResponse {
    return new TotpEnrollmentResponse(params.secret, params.otpauthUrl);
  }
}

export class TotpConfirmationDto {
  private constructor(public readonly code: string) {}

  static of(params: { code: string }): TotpConfirmationDto {
    return new TotpConfirmationDto(params.code);
  }
}

export class TotpConfirmationResponse {
  private constructor(public readonly recoveryCodes: string[]) {}

  static of(params: { recoveryCodes: string[] }): TotpConfirmationResponse {
    return new TotpConfirmationResponse(params.recoveryCodes);
  }
}

export class RecoveryCodeStatusResponse {
  private constructor(
    public readonly remaining: number,
    public readonly total: number,
    public readonly used: number,
    public readonly low: boolean,
  ) {}

  static of(params: {
    remaining: number;
    total: number;
    used: number;
    low: boolean;
  }): RecoveryCodeStatusResponse {
    return new RecoveryCodeStatusResponse(
      params.remaining,
      params.total,
      params.used,
      params.low,
    );
  }
}

export class RotateRecoveryCodesResponse {
  private constructor(public readonly recoveryCodes: string[]) {}

  static of(params: { recoveryCodes: string[] }): RotateRecoveryCodesResponse {
    return new RotateRecoveryCodesResponse(params.recoveryCodes);
  }
}

export class UpdateMfaPreferenceDto {
  private constructor(public readonly enabled: boolean) {}

  static of(params: { enabled: boolean }): UpdateMfaPreferenceDto {
    return new UpdateMfaPreferenceDto(params.enabled);
  }
}

export class UpdateProfileDto {
  private constructor(
    public readonly email?: string,
    public readonly phone?: string,
  ) {}

  static of(params: { email?: string; phone?: string }): UpdateProfileDto {
    return new UpdateProfileDto(params.email, params.phone);
  }
}

export class ProfileResponse {
  private constructor(
    public readonly id: string,
    public readonly username: string,
    public readonly email: string | null | undefined,
    public readonly emailVerified: boolean,
    public readonly phone: string | null | undefined,
    public readonly phoneVerified: boolean,
    public readonly status: string,
    public readonly mfaEnabled: boolean,
    public readonly createdAt?: Date,
    public readonly updatedAt?: Date,
  ) {}

  static of(params: {
    id: string;
    username: string;
    email?: string | null;
    emailVerified: boolean;
    phone?: string | null;
    phoneVerified: boolean;
    status: string;
    mfaEnabled: boolean;
    createdAt?: Date;
    updatedAt?: Date;
  }): ProfileResponse {
    return new ProfileResponse(
      params.id,
      params.username,
      params.email,
      params.emailVerified,
      params.phone,
      params.phoneVerified,
      params.status,
      params.mfaEnabled,
      params.createdAt,
      params.updatedAt,
    );
  }
}

export class ConsentResponse {
  private constructor(
    public readonly clientId: string,
    public readonly clientName: string,
    public readonly grantedScopes: string,
    public readonly grantedAt: Date,
  ) {}

  static of(params: {
    clientId: string;
    clientName: string;
    grantedScopes: string;
    grantedAt: Date;
  }): ConsentResponse {
    return new ConsentResponse(
      params.clientId,
      params.clientName,
      params.grantedScopes,
      params.grantedAt,
    );
  }
}

export class IdentityLinkResponse {
  private constructor(
    public readonly id: string,
    public readonly provider: string,
    public readonly email: string | null | undefined,
    public readonly linkedAt: Date,
  ) {}

  static of(params: {
    id: string;
    provider: string;
    email?: string | null;
    linkedAt: Date;
  }): IdentityLinkResponse {
    return new IdentityLinkResponse(
      params.id,
      params.provider,
      params.email,
      params.linkedAt,
    );
  }
}

export class StartIdentityLinkDto {
  private constructor(
    public readonly provider: string,
    public readonly tenantCode: string,
    public readonly redirectUri: string,
    public readonly returnTo?: string | null,
  ) {}

  static of(params: {
    provider: string;
    tenantCode: string;
    redirectUri: string;
    returnTo?: string | null;
  }): StartIdentityLinkDto {
    return new StartIdentityLinkDto(
      params.provider,
      params.tenantCode,
      params.redirectUri,
      params.returnTo,
    );
  }
}

export class StartIdentityLinkResponse {
  private constructor(public readonly authorizationUrl: string) {}

  static of(params: { authorizationUrl: string }): StartIdentityLinkResponse {
    return new StartIdentityLinkResponse(params.authorizationUrl);
  }
}

export class CompleteIdentityLinkDto {
  private constructor(
    public readonly provider?: string | null,
    public readonly state?: string | null,
    public readonly code?: string | null,
    public readonly error?: string | null,
  ) {}

  static of(params: {
    provider?: string | null;
    state?: string | null;
    code?: string | null;
    error?: string | null;
  }): CompleteIdentityLinkDto {
    return new CompleteIdentityLinkDto(
      params.provider,
      params.state,
      params.code,
      params.error,
    );
  }
}

export class CompleteIdentityLinkResponse {
  private constructor(public readonly redirectTo: string) {}

  static of(params: { redirectTo: string }): CompleteIdentityLinkResponse {
    return new CompleteIdentityLinkResponse(params.redirectTo);
  }
}
