import {
  Injectable,
  ConflictException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { GroupCommandPort } from '../ports/group-command.port';
import { AuditContext, CreateGroupDto, UpdateGroupDto } from '@application/dto';
import {
  GroupRepository,
  RoleRepository,
  RoleAssignmentRepository,
} from '@domain/repositories';
import { GroupModel } from '@domain/models/group';
import { orThrow } from '@domain/utils';
import { AuditRecorder } from '@application/services/audit-recorder';

@Injectable()
export class GroupCommandHandler implements GroupCommandPort {
  private readonly logger = new Logger(GroupCommandHandler.name);

  constructor(
    private readonly groupRepo: GroupRepository,
    private readonly roleRepo: RoleRepository,
    private readonly roleAssignment: RoleAssignmentRepository,
    private readonly auditRecorder?: AuditRecorder,
  ) {}

  async createGroup(
    tenantId: string,
    dto: CreateGroupDto,
    auditContext?: AuditContext,
  ): Promise<{ id: string }> {
    this.logger.log(`Creating group code=${dto.code} in tenant=${tenantId}`);

    const existing = await this.groupRepo.findByCode(tenantId, dto.code);
    if (existing) throw new ConflictException('Group code already exists');

    const group = new GroupModel({
      tenantId,
      code: dto.code,
      name: dto.name,
      parentId: dto.parentId ?? null,
    });

    const saved = await this.groupRepo.save(group);
    await this.auditRecorder?.recordAdminAction({
      tenantId,
      category: 'GROUP',
      action: 'CREATE',
      resourceType: 'group',
      resourceId: saved.id,
      metadata: {
        code: saved.code,
        parentId: saved.parentId ?? null,
      },
      auditContext,
    });
    return { id: saved.id };
  }

  async updateGroup(
    tenantId: string,
    id: string,
    dto: UpdateGroupDto,
    auditContext?: AuditContext,
  ): Promise<void> {
    this.logger.log(`Updating group id=${id} in tenant=${tenantId}`);

    const group = orThrow(
      await this.groupRepo.findById(id),
      new NotFoundException('Group not found'),
      (g) => g.tenantId === tenantId,
    );

    if (dto.name) group.changeName(dto.name);
    if (dto.parentId !== undefined) group.changeParent(dto.parentId);

    await this.groupRepo.save(group);
    await this.auditRecorder?.recordAdminAction({
      tenantId,
      category: 'GROUP',
      action: 'UPDATE',
      resourceType: 'group',
      resourceId: id,
      metadata: { changedFields: Object.keys(dto) },
      auditContext,
    });
  }

  async deleteGroup(
    tenantId: string,
    id: string,
    auditContext?: AuditContext,
  ): Promise<void> {
    this.logger.log(`Deleting group id=${id} in tenant=${tenantId}`);

    const group = orThrow(
      await this.groupRepo.findById(id),
      new NotFoundException('Group not found'),
      (g) => g.tenantId === tenantId,
    );

    await this.auditRecorder?.recordAdminAction({
      tenantId,
      category: 'GROUP',
      action: 'DELETE',
      resourceType: 'group',
      resourceId: id,
      metadata: { code: group.code },
      auditContext,
    });
    await this.groupRepo.delete(id);
  }

  async assignRole(
    tenantId: string,
    groupId: string,
    roleId: string,
    auditContext?: AuditContext,
  ): Promise<void> {
    this.logger.log(
      `Assigning role=${roleId} to group=${groupId} in tenant=${tenantId}`,
    );

    orThrow(
      await this.groupRepo.findById(groupId),
      new NotFoundException('Group not found'),
      (g) => g.tenantId === tenantId,
    );

    orThrow(
      await this.roleRepo.findById(roleId),
      new NotFoundException('Role not found'),
      (r) => r.tenantId === tenantId,
    );

    const alreadyAssigned = await this.roleAssignment.existsForGroup({
      groupId,
      roleId,
    });
    if (alreadyAssigned) return;

    await this.roleAssignment.assignToGroup({ groupId, roleId });
    await this.auditRecorder?.recordAdminAction({
      tenantId,
      category: 'GROUP',
      action: 'ASSIGN',
      resourceType: 'group-role',
      resourceId: groupId,
      metadata: { roleId },
      auditContext,
    });
  }

  async removeRole(
    tenantId: string,
    groupId: string,
    roleId: string,
    auditContext?: AuditContext,
  ): Promise<void> {
    this.logger.log(
      `Removing role=${roleId} from group=${groupId} in tenant=${tenantId}`,
    );

    orThrow(
      await this.groupRepo.findById(groupId),
      new NotFoundException('Group not found'),
      (g) => g.tenantId === tenantId,
    );

    await this.roleAssignment.removeFromGroup({ groupId, roleId });
    await this.auditRecorder?.recordAdminAction({
      tenantId,
      category: 'GROUP',
      action: 'REVOKE',
      resourceType: 'group-role',
      resourceId: groupId,
      metadata: { roleId },
      auditContext,
    });
  }
}
