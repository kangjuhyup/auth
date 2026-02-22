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
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ConsentResponse {
  clientId: string;
  clientName: string;
  grantedScopes: string;
  grantedAt: Date;
}
