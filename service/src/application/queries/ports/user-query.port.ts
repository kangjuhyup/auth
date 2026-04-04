import type { MfaMethodType } from '@application/ports/mfa-verification.port';

export abstract class UserQueryPort {
  abstract findProfile(params: {
    tenantId: string;
    userId: string;
  }): Promise<UserProfileView | null>;

  abstract findClaimsBySub(params: {
    tenantId: string;
    sub: string;
  }): Promise<UserClaimsView | null>;

  abstract findByUsername(params: {
    tenantId: string;
    username: string;
  }): Promise<UserProfileView | null>;

  abstract authenticate(params: {
    tenantId: string;
    username: string;
    password: string;
  }): Promise<{ userId: string } | null>;

  abstract getMfaMethods(
    tenantId: string,
    userId: string,
  ): Promise<MfaMethodType[]>;

  abstract verifyMfa(params: {
    tenantId: string;
    userId: string;
    method: MfaMethodType;
    code?: string;
    webauthnResponse?: Record<string, unknown>;
    rpId?: string;
    expectedOrigin?: string;
  }): Promise<boolean>;
}

/* ===============================
   Read Model Types
================================ */

export type UserProfileView = Readonly<{
  userId: string;
  tenantId: string;
  username: string;
  email?: string;
  emailVerified: boolean;
  phone?: string;
  phoneVerified: boolean;
  status: 'ACTIVE' | 'LOCKED' | 'DISABLED' | 'WITHDRAWN';
  createdAt?: Date;
  updatedAt?: Date;
}>;

export type UserClaimsView = Readonly<{
  sub: string;
  email?: string;
  email_verified?: boolean;
}>;
