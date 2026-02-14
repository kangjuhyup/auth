export class SignupDto {
  username!: string;
  password!: string;
  email?: string;
  phone?: string;
}

export class WithdrawDto {
  password!: string;
}

export class ChangePasswordDto {
  currentPassword!: string;
  newPassword!: string;
}

export class PasswordResetRequestDto {
  email!: string;
}

export class PasswordResetDto {
  newPassword!: string;
}

export class UpdateProfileDto {
  email?: string;
  phone?: string;
}

export class ProfileResponse {
  id!: string;
  username!: string;
  email?: string | null;
  emailVerified!: boolean;
  phone?: string | null;
  phoneVerified!: boolean;
  status!: string;
  createdAt!: Date;
}

export class ConsentResponse {
  clientId!: string;
  clientName!: string;
  grantedScopes!: string;
  grantedAt!: Date;
}
