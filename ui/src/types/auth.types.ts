export interface AuthSession {
  isAuthenticated: boolean;
  token: string | null;
  username: string | null;
}

export interface LoginDto {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
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

export interface IdentityLinkResponse {
  id: string;
  provider: string;
  email?: string | null;
  linkedAt: string | Date;
}
