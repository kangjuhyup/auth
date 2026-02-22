export class CreateTenantDto {
  code!: string;
  name!: string;
  signupPolicy?: 'invite' | 'open';
  requirePhoneVerify?: boolean;
  brandName?: string;
}

export class UpdateTenantDto {
  name?: string;
  signupPolicy?: 'invite' | 'open';
  requirePhoneVerify?: boolean;
  brandName?: string;
}

export class TenantResponse {
  id!: string;
  code!: string;
  name!: string;
  signupPolicy!: string;
  requirePhoneVerify!: boolean;
  brandName?: string | null;
  createdAt!: Date;
  updatedAt!: Date;
}
