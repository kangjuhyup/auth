import { CreateTenantDto, UpdateTenantDto } from '@application/dto';

export abstract class TenantCommandPort {
  /**
   * Create a new tenant
   * @description 신규 테넌트 생성
   */
  abstract createTenant(dto: CreateTenantDto): Promise<{ id: string }>;

  /**
   * Update an existing tenant
   * @description 테넌트 정보 수정
   */
  abstract updateTenant(id: string, dto: UpdateTenantDto): Promise<void>;

  /**
   * Delete a tenant
   * @description 테넌트 삭제
   */
  abstract deleteTenant(id: string): Promise<void>;
}
