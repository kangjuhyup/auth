import { CreateClientDto, UpdateClientDto } from '@application/dto';

export const CLIENT_COMMAND_PORT = Symbol('CLIENT_COMMAND_PORT');

export interface ClientCommandPort {
  /**
   * Register a new OIDC client
   * @description OIDC 클라이언트 등록
   * @param tenantId - 테넌트 ID
   * @param dto - 클라이언트 생성 DTO
   * @returns 생성된 클라이언트 ID
   */
  createClient(tenantId: string, dto: CreateClientDto): Promise<{ id: string }>;

  /**
   * Update an existing OIDC client
   * @description OIDC 클라이언트 정보 수정
   * @param tenantId - 테넌트 ID
   * @param id - 클라이언트 ID
   * @param dto - 클라이언트 수정 DTO
   */
  updateClient(
    tenantId: string,
    id: string,
    dto: UpdateClientDto,
  ): Promise<void>;

  /**
   * Delete an OIDC client
   * @description OIDC 클라이언트 삭제
   * @param tenantId - 테넌트 ID
   * @param id - 클라이언트 ID
   */
  deleteClient(tenantId: string, id: string): Promise<void>;
}
