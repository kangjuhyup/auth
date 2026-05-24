export interface CreateUserDto {
  username: string;
  password: string;
  email?: string;
  phone?: string;
  status?: 'ACTIVE' | 'LOCKED' | 'DISABLED';
}

export interface UpdateUserDto {
  email?: string;
  phone?: string;
  status?: 'ACTIVE' | 'LOCKED' | 'DISABLED';
}

export interface UserResponse {
  id: string;
  username: string;
  email?: string | null;
  emailVerified: boolean;
  phone?: string | null;
  phoneVerified: boolean;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export type UserConsentStatus = 'ACTIVE' | 'REVOKED';

export interface UserConsentResponse {
  id: string;
  userId: string;
  clientRefId: string;
  clientId: string;
  clientName: string;
  grantedScopes: string;
  grantedAt: Date | string;
  revokedAt?: Date | string | null;
  status: UserConsentStatus;
}
