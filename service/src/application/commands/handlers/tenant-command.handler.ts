import {
  Injectable,
  ConflictException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { TenantCommandPort } from '../ports/tenant-command.port';
import { CreateTenantDto, UpdateTenantDto } from '@application/dto';
import { TenantRepository } from '@domain/repositories';
import { TenantModel } from '@domain/models/tenant';
import { orThrow } from '@domain/utils';
import { AuditRecorder } from '@application/services/audit-recorder';

@Injectable()
export class TenantCommandHandler implements TenantCommandPort {
  private readonly logger = new Logger(TenantCommandHandler.name);

  constructor(
    private readonly tenantRepo: TenantRepository,
    private readonly auditRecorder?: AuditRecorder,
  ) {}

  async createTenant(dto: CreateTenantDto): Promise<{ id: string }> {
    this.logger.log(`Creating tenant with code=${dto.code}`);

    const existing = await this.tenantRepo.findByCode(dto.code);
    if (existing) throw new ConflictException('Tenant code already exists');

    const tenant = new TenantModel({ code: dto.code, name: dto.name });
    const saved = await this.tenantRepo.save(tenant);
    await this.auditRecorder?.recordAdminAction({
      tenantId: saved.id,
      action: 'CREATE',
      resourceType: 'tenant',
      resourceId: saved.id,
      metadata: { code: saved.code },
    });

    return { id: saved.id };
  }

  async updateTenant(id: string, dto: UpdateTenantDto): Promise<void> {
    this.logger.log(`Updating tenant id=${id}`);

    const tenant = orThrow(
      await this.tenantRepo.findById(id),
      new NotFoundException('Tenant not found'),
    );

    if (dto.name) tenant.changeName(dto.name);

    await this.tenantRepo.save(tenant);
    await this.auditRecorder?.recordAdminAction({
      tenantId: tenant.id,
      action: 'UPDATE',
      resourceType: 'tenant',
      resourceId: tenant.id,
      metadata: { changedFields: Object.keys(dto) },
    });
  }

  async deleteTenant(id: string): Promise<void> {
    this.logger.log(`Deleting tenant id=${id}`);

    orThrow(
      await this.tenantRepo.findById(id),
      new NotFoundException('Tenant not found'),
    );

    await this.auditRecorder?.recordAdminAction({
      tenantId: id,
      action: 'DELETE',
      resourceType: 'tenant',
      resourceId: id,
    });
    await this.tenantRepo.delete(id);
  }
}
