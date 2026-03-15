import { ProfileResponse, ConsentResponse } from '@application/dto';

export abstract class AuthQueryPort {
  abstract getProfile(tenantId: string, userId: string): Promise<ProfileResponse>;
  abstract getConsents(tenantId: string, userId: string): Promise<ConsentResponse[]>;
}
