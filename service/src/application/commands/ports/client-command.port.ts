import {
  CreateClientDto,
  UpdateClientAuthPolicyDto,
  UpdateClientDto,
} from '@application/dto';

export abstract class ClientCommandPort {
  /**
   * Register a new OIDC client
   * @description OIDC 클라이언트 등록
   */
  abstract createClient(
    tenantId: string,
    dto: CreateClientDto,
  ): Promise<{ id: string }>;

  /**
   * Update an existing OIDC client
   * @description OIDC 클라이언트 정보 수정
   */
  abstract updateClient(
    tenantId: string,
    id: string,
    dto: UpdateClientDto,
  ): Promise<void>;

  /**
   * Update client-specific authentication and refresh token policy
   * @description 클라이언트별 인증/리프레시 토큰 정책 수정
   */
  abstract updateClientAuthPolicy(
    tenantId: string,
    id: string,
    dto: UpdateClientAuthPolicyDto,
  ): Promise<void>;

  /**
   * Delete an OIDC client
   * @description OIDC 클라이언트 삭제
   */
  abstract deleteClient(tenantId: string, id: string): Promise<void>;
}
