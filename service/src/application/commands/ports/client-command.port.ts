import { CreateClientDto, UpdateClientDto } from '@application/dto';

export abstract class ClientCommandPort {
  /**
   * Register a new OIDC client
   * @description OIDC 클라이언트 등록
   */
  abstract createClient(tenantId: string, dto: CreateClientDto): Promise<{ id: string }>;

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
   * Delete an OIDC client
   * @description OIDC 클라이언트 삭제
   */
  abstract deleteClient(tenantId: string, id: string): Promise<void>;
}
