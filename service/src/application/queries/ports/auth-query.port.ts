import {
  ProfileResponse,
  ConsentResponse,
  IdentityLinkResponse,
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
}
