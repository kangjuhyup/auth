import { CreateTenantDto, UpdateTenantDto } from '@application/dto';

export const TENANT_COMMAND_PORT = Symbol('TENANT_COMMAND_PORT');

export interface TenantCommandPort {
  /**
   * Create a new tenant
   * @description 신규 테넌트 생성
   * @param dto - 테넌트 생성 DTO
   * @returns 생성된 테넌트 ID
   */
  createTenant(dto: CreateTenantDto): Promise<{ id: string }>;

  /**
   * Update an existing tenant
   * @description 테넌트 정보 수정
   * @param id - 테넌트 ID
   * @param dto - 테넌트 수정 DTO
   */
  updateTenant(id: string, dto: UpdateTenantDto): Promise<void>;

  /**
   * Delete a tenant
   * @description 테넌트 삭제
   * @param id - 테넌트 ID
   */
  deleteTenant(id: string): Promise<void>;
}
