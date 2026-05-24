export interface SignupDto {
  username: string;
  password: string;
  email?: string;
  phone?: string;
}

export interface WithdrawDto {
  password: string;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export interface PasswordResetRequestDto {
  email?: string;
  phone?: string;
}

export interface PasswordResetDto {
  token: string;
  newPassword: string;
}

export interface VerificationTokenDto {
  token: string;
}

export interface TotpEnrollmentResponse {
  secret: string;
  otpauthUrl: string;
}

export interface TotpConfirmationDto {
  code: string;
}

export interface TotpConfirmationResponse {
  recoveryCodes: string[];
}

export interface UpdateMfaPreferenceDto {
  enabled: boolean;
}

export interface UpdateProfileDto {
  email?: string;
  phone?: string;
}

export interface ProfileResponse {
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
}

export interface ConsentResponse {
  clientId: string;
  clientName: string;
  grantedScopes: string;
  grantedAt: Date;
}

export interface IdentityLinkResponse {
  id: string;
  provider: string;
  email?: string | null;
  linkedAt: Date;
}

export interface StartIdentityLinkDto {
  provider: string;
  tenantCode: string;
  redirectUri: string;
  returnTo?: string | null;
}

export interface StartIdentityLinkResponse {
  authorizationUrl: string;
}

export interface CompleteIdentityLinkDto {
  provider?: string | null;
  state?: string | null;
  code?: string | null;
  error?: string | null;
}

export interface CompleteIdentityLinkResponse {
  redirectTo: string;
}
