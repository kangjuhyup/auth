import { ConflictException, Logger, NotFoundException } from '@nestjs/common';
import { PermissionCommandPort } from '../ports/permission-command.port';
import { CreatePermissionDto, UpdatePermissionDto } from '@application/dto';
import { PermissionRepository } from '@domain/repositories';
import { PermissionModel } from '@domain/models/permission';
import { orThrow } from '@domain/utils';

export class PermissionCommandHandler implements PermissionCommandPort {
  private readonly logger = new Logger(PermissionCommandHandler.name);

  constructor(private readonly permissionRepo: PermissionRepository) {}

  async createPermission(
    tenantId: string,
    dto: CreatePermissionDto,
  ): Promise<{ id: string }> {
    this.logger.log(`Creating permission code=${dto.code} in tenant=${tenantId}`);

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
    return { id: saved.id };
  }

  async updatePermission(
    tenantId: string,
    id: string,
    dto: UpdatePermissionDto,
  ): Promise<void> {
    this.logger.log(`Updating permission id=${id} in tenant=${tenantId}`);

    const permission = orThrow(
      await this.permissionRepo.findById(id),
      new NotFoundException('Permission not found'),
      (p) => p.tenantId === tenantId,
    );

    if (dto.resource !== undefined) permission.changeResource(dto.resource ?? null);
    if (dto.action !== undefined) permission.changeAction(dto.action ?? null);
    if (dto.description !== undefined) permission.changeDescription(dto.description ?? null);

    await this.permissionRepo.save(permission);
  }

  async deletePermission(tenantId: string, id: string): Promise<void> {
    this.logger.log(`Deleting permission id=${id} in tenant=${tenantId}`);

    orThrow(
      await this.permissionRepo.findById(id),
      new NotFoundException('Permission not found'),
      (p) => p.tenantId === tenantId,
    );

    await this.permissionRepo.delete(id);
  }
}
