import {
  Injectable,
  ConflictException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PermissionCommandPort } from '../ports/permission-command.port';
import {
  AuditContext,
  CreatePermissionDto,
  UpdatePermissionDto,
} from '@application/dto';
import { PermissionRepository } from '@domain/repositories';
import { PermissionModel } from '@domain/models/permission';
import { orThrow } from '@domain/utils';
import { AuditRecorder } from '@application/services/audit-recorder';

@Injectable()
export class PermissionCommandHandler implements PermissionCommandPort {
  private readonly logger = new Logger(PermissionCommandHandler.name);

  constructor(
    private readonly permissionRepo: PermissionRepository,
    private readonly auditRecorder?: AuditRecorder,
  ) {}

  async createPermission(
    tenantId: string,
    dto: CreatePermissionDto,
    auditContext?: AuditContext,
  ): Promise<{ id: string }> {
    this.logger.log(
      `Creating permission code=${dto.code} in tenant=${tenantId}`,
    );

    const existing = await this.permissionRepo.findByCode(tenantId, dto.code);
    if (existing) throw new ConflictException('Permission code already exists');

    const permission = new PermissionModel({
      tenantId,
      code: dto.code,
      resource: dto.resource ?? null,
      action: dto.action ?? null,
      description: dto.description ?? null,
    });

    const saved = await this.permissionRepo.save(permission);
    await this.auditRecorder?.recordAdminAction({
      tenantId,
      category: 'PERMISSION',
      action: 'CREATE',
      resourceType: 'permission',
      resourceId: saved.id,
      metadata: {
        code: saved.code,
        resource: saved.resource ?? null,
        action: saved.action ?? null,
      },
      auditContext,
    });
    return { id: saved.id };
  }

  async updatePermission(
    tenantId: string,
    id: string,
    dto: UpdatePermissionDto,
    auditContext?: AuditContext,
  ): Promise<void> {
    this.logger.log(`Updating permission id=${id} in tenant=${tenantId}`);

    const permission = orThrow(
      await this.permissionRepo.findById(id),
      new NotFoundException('Permission not found'),
      (p) => p.tenantId === tenantId,
    );

    if (dto.resource !== undefined)
      permission.changeResource(dto.resource ?? null);
    if (dto.action !== undefined) permission.changeAction(dto.action ?? null);
    if (dto.description !== undefined)
      permission.changeDescription(dto.description ?? null);

    await this.permissionRepo.save(permission);
    await this.auditRecorder?.recordAdminAction({
      tenantId,
      category: 'PERMISSION',
      action: 'UPDATE',
      resourceType: 'permission',
      resourceId: id,
      metadata: { changedFields: Object.keys(dto) },
      auditContext,
    });
  }

  async deletePermission(
    tenantId: string,
    id: string,
    auditContext?: AuditContext,
  ): Promise<void> {
    this.logger.log(`Deleting permission id=${id} in tenant=${tenantId}`);

    const permission = orThrow(
      await this.permissionRepo.findById(id),
      new NotFoundException('Permission not found'),
      (p) => p.tenantId === tenantId,
    );

    await this.auditRecorder?.recordAdminAction({
      tenantId,
      category: 'PERMISSION',
      action: 'DELETE',
      resourceType: 'permission',
      resourceId: id,
      metadata: { code: permission.code },
      auditContext,
    });
    await this.permissionRepo.delete(id);
  }
}
