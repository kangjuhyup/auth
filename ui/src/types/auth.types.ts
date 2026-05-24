export interface AuthSession {
  isAuthenticated: boolean;
  username: string | null;
}

export interface LoginDto {
  username: string;
  password: string;
}

export interface LoginResponse {
  username: string;
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
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface TotpEnrollmentResponse {
  secret: string;
  otpauthUrl: string;
}

export interface TotpConfirmationResponse {
  recoveryCodes: string[];
}

export interface RecoveryCodeStatusResponse {
  remaining: number;
  total: number;
  used: number;
  low: boolean;
}

export interface IdentityLinkResponse {
  id: string;
  provider: string;
  email?: string | null;
  linkedAt: string | Date;
}

export interface StartIdentityLinkResponse {
  authorizationUrl: string;
}
