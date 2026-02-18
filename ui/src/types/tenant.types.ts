export interface TenantContext {
  id: string;
  code: string;
  name: string;
}

export interface CreateTenantDto {
  code: string;
  name: string;
  signupPolicy?: 'invite' | 'open';
  requirePhoneVerify?: boolean;
  brandName?: string;
}

export interface UpdateTenantDto {
  name?: string;
  signupPolicy?: 'invite' | 'open';
  requirePhoneVerify?: boolean;
  brandName?: string;
}

export interface TenantResponse {
  id: string;
  code: string;
  name: string;
  signupPolicy: string;
  requirePhoneVerify: boolean;
  brandName?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
