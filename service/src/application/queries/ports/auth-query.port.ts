import {
  ProfileResponse,
  ConsentResponse,
  IdentityLinkResponse,
  RecoveryCodeStatusResponse,
} from '@application/dto';

export abstract class AuthQueryPort {
  abstract getProfile(
    tenantId: string,
    userId: string,
  ): Promise<ProfileResponse>;
  abstract getConsents(
    tenantId: string,
    userId: string,
  ): Promise<ConsentResponse[]>;
  abstract getIdentityLinks(
    tenantId: string,
    userId: string,
  ): Promise<IdentityLinkResponse[]>;
  abstract getRecoveryCodeStatus(
    tenantId: string,
    userId: string,
  ): Promise<RecoveryCodeStatusResponse>;
}
