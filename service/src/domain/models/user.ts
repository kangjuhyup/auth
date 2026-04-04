import { PersistenceModel } from './persistence-model';
import { UserCredentialModel } from './user-credential';

export type UserStatus = 'ACTIVE' | 'LOCKED' | 'DISABLED' | 'WITHDRAWN';

interface UserProps {
  tenantId: string;
  username: string;
  email?: string | null;
  emailVerified: boolean;
  phone?: string | null;
  phoneVerified: boolean;
  status: UserStatus;
  passwordCredential?: UserCredentialModel;
}

export class UserModel extends PersistenceModel<string, UserProps> {
  private constructor(props: UserProps, id: string) {
    super(props, id);
  }

  /* ==============================
     Factories
  =============================== */

  static create(params: {
    id: string;
    tenantId: string;
    username: string;
    email?: string | null;
    phone?: string | null;
    passwordCredential: UserCredentialModel;
  }): UserModel {
    return new UserModel(
      {
        tenantId: params.tenantId,
        username: params.username.trim(),
        email: params.email ?? null,
        emailVerified: false,
        phone: params.phone ?? null,
        phoneVerified: false,
        status: 'ACTIVE',
        passwordCredential: params.passwordCredential,
      },
      params.id,
    );
  }

  static of(params: {
    id: string;
    tenantId: string;
    username: string;
    email?: string | null;
    emailVerified: boolean;
    phone?: string | null;
    phoneVerified: boolean;
    status: UserStatus;
    passwordCredential?: UserCredentialModel;
  }): UserModel {
    return new UserModel(
      {
        tenantId: params.tenantId,
        username: params.username,
        email: params.email ?? null,
        emailVerified: params.emailVerified,
        phone: params.phone ?? null,
        phoneVerified: params.phoneVerified,
        status: params.status,
        passwordCredential: params.passwordCredential,
      },
      params.id,
    );
  }

  /* ==============================
     Commands (Domain behaviors)
  =============================== */

  withdraw(): void {
    if (this.status === 'WITHDRAWN') throw new Error('AlreadyWithdrawn');
    this.etc.status = 'WITHDRAWN';
  }

  changePassword(newCredential: UserCredentialModel): void {
    if (this.status === 'WITHDRAWN') throw new Error('UserAlreadyWithdrawn');
    this.etc.passwordCredential = newCredential;
  }

  getPasswordCredential(): UserCredentialModel {
    const c = this.etc.passwordCredential;
    if (!c) throw new Error('PasswordCredentialNotFound');
    return c;
  }

  changeEmail(email: string | null): void {
    if (this.status === 'WITHDRAWN') throw new Error('UserAlreadyWithdrawn');
    this.etc.email = email;
    this.etc.emailVerified = false;
  }

  changePhone(phone: string | null): void {
    if (this.status === 'WITHDRAWN') throw new Error('UserAlreadyWithdrawn');
    this.etc.phone = phone;
    this.etc.phoneVerified = false;
  }

  changeStatus(status: UserStatus): void {
    if (this.status === 'WITHDRAWN') throw new Error('UserAlreadyWithdrawn');
    this.etc.status = status;
  }

  /* ==============================
     Getters
  =============================== */

  get tenantId(): string {
    return this.etc.tenantId;
  }
  get username(): string {
    return this.etc.username;
  }
  get email(): string | null | undefined {
    return this.etc.email;
  }
  get emailVerified(): boolean {
    return this.etc.emailVerified;
  }
  get phone(): string | null | undefined {
    return this.etc.phone;
  }
  get phoneVerified(): boolean {
    return this.etc.phoneVerified;
  }
  get status(): UserStatus {
    return this.etc.status;
  }
  get passwordCredential(): UserCredentialModel | undefined {
    return this.etc.passwordCredential;
  }
}
