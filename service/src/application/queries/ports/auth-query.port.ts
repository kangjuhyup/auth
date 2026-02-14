import { ProfileResponse, ConsentResponse } from '@application/dto';

export const AUTH_QUERY_PORT = Symbol('AUTH_QUERY_PORT');

export interface AuthQueryPort {
  getProfile(tenantId: string, userId: string): Promise<ProfileResponse>;
  getConsents(tenantId: string, userId: string): Promise<ConsentResponse[]>;
}
