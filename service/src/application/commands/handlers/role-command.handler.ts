import { ConflictException, Logger, NotFoundException } from '@nestjs/common';
import { RoleCommandPort } from '../ports/role-command.port';
import { CreateRoleDto, UpdateRoleDto } from '@application/dto';
import { RoleRepository, PermissionRepository, RolePermissionRepository } from '@domain/repositories';
import { RoleModel } from '@domain/models/role';

export class RoleCommandHandler implements RoleCommandPort {
  private readonly logger = new Logger(RoleCommandHandler.name);

  constructor(
    private readonly roleRepo: RoleRepository,
    private readonly permissionRepo: PermissionRepository,
    private readonly rolePermissionRepo: RolePermissionRepository,
  ) {}

  async createRole(
    tenantId: string,
    dto: CreateRoleDto,
  ): Promise<{ id: string }> {
    this.logger.log(`Creating role code=${dto.code} in tenant=${tenantId}`);

    const existing = await this.roleRepo.findByCode(tenantId, dto.code);
    if (existing) throw new ConflictException('Role code already exists');

    const role = new RoleModel({
      tenantId,
      code: dto.code,
      name: dto.name,
      description: dto.description ?? null,
    });

    const saved = await this.roleRepo.save(role);
    return { id: saved.id };
  }

  async updateRole(
    tenantId: string,
    id: string,
    dto: UpdateRoleDto,
  ): Promise<void> {
    this.logger.log(`Updating role id=${id} in tenant=${tenantId}`);

    const role = await this.roleRepo.findById(id);
    if (!role) throw new NotFoundException('Role not found');
    if (role.tenantId !== tenantId) throw new NotFoundException('Role not found');

    if (dto.name) role.changeName(dto.name);
    if (dto.description !== undefined) role.changeDescription(dto.description ?? null);

    await this.roleRepo.save(role);
  }

  async deleteRole(tenantId: string, id: string): Promise<void> {
    this.logger.log(`Deleting role id=${id} in tenant=${tenantId}`);

    const role = await this.roleRepo.findById(id);
    if (!role) throw new NotFoundException('Role not found');
    if (role.tenantId !== tenantId) throw new NotFoundException('Role not found');

    await this.roleRepo.delete(id);
  }

  async addPermissionToRole(
    tenantId: string,
    roleId: string,
    permissionId: string,
  ): Promise<void> {
    this.logger.log(`Adding permission=${permissionId} to role=${roleId} in tenant=${tenantId}`);

    const role = await this.roleRepo.findById(roleId);
    if (!role || role.tenantId !== tenantId) throw new NotFoundException('Role not found');

    const permission = await this.permissionRepo.findById(permissionId);
    if (!permission || permission.tenantId !== tenantId)
      throw new NotFoundException('Permission not found');

    const already = await this.rolePermissionRepo.exists({ roleId, permissionId });
    if (already) throw new ConflictException('Permission already assigned to role');

    await this.rolePermissionRepo.add({ roleId, permissionId });
  }

  async removePermissionFromRole(
    tenantId: string,
    roleId: string,
    permissionId: string,
  ): Promise<void> {
    this.logger.log(`Removing permission=${permissionId} from role=${roleId} in tenant=${tenantId}`);

    const role = await this.roleRepo.findById(roleId);
    if (!role || role.tenantId !== tenantId) throw new NotFoundException('Role not found');

    const exists = await this.rolePermissionRepo.exists({ roleId, permissionId });
    if (!exists) throw new NotFoundException('Permission not assigned to role');

    await this.rolePermissionRepo.remove({ roleId, permissionId });
  }
}
