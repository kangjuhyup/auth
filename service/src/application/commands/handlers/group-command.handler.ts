import { ConflictException, Logger, NotFoundException } from '@nestjs/common';
import { GroupCommandPort } from '../ports/group-command.port';
import { CreateGroupDto, UpdateGroupDto } from '@application/dto';
import { GroupRepository, RoleRepository, RoleAssignmentRepository } from '@domain/repositories';
import { GroupModel } from '@domain/models/group';

export class GroupCommandHandler implements GroupCommandPort {
  private readonly logger = new Logger(GroupCommandHandler.name);

  constructor(
    private readonly groupRepo: GroupRepository,
    private readonly roleRepo: RoleRepository,
    private readonly roleAssignment: RoleAssignmentRepository,
  ) {}

  async createGroup(
    tenantId: string,
    dto: CreateGroupDto,
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
    return { id: saved.id };
  }

  async updateGroup(
    tenantId: string,
    id: string,
    dto: UpdateGroupDto,
  ): Promise<void> {
    this.logger.log(`Updating group id=${id} in tenant=${tenantId}`);

    const group = await this.groupRepo.findById(id);
    if (!group) throw new NotFoundException('Group not found');
    if (group.tenantId !== tenantId) throw new NotFoundException('Group not found');

    if (dto.name) group.changeName(dto.name);
    if (dto.parentId !== undefined) group.changeParent(dto.parentId);

    await this.groupRepo.save(group);
  }

  async deleteGroup(tenantId: string, id: string): Promise<void> {
    this.logger.log(`Deleting group id=${id} in tenant=${tenantId}`);

    const group = await this.groupRepo.findById(id);
    if (!group) throw new NotFoundException('Group not found');
    if (group.tenantId !== tenantId) throw new NotFoundException('Group not found');

    await this.groupRepo.delete(id);
  }

  async assignRole(tenantId: string, groupId: string, roleId: string): Promise<void> {
    this.logger.log(`Assigning role=${roleId} to group=${groupId} in tenant=${tenantId}`);

    const group = await this.groupRepo.findById(groupId);
    if (!group) throw new NotFoundException('Group not found');
    if (group.tenantId !== tenantId) throw new NotFoundException('Group not found');

    const role = await this.roleRepo.findById(roleId);
    if (!role) throw new NotFoundException('Role not found');
    if (role.tenantId !== tenantId) throw new NotFoundException('Role not found');

    await this.roleAssignment.assignToGroup({ groupId, roleId });
  }

  async removeRole(tenantId: string, groupId: string, roleId: string): Promise<void> {
    this.logger.log(`Removing role=${roleId} from group=${groupId} in tenant=${tenantId}`);

    const group = await this.groupRepo.findById(groupId);
    if (!group) throw new NotFoundException('Group not found');
    if (group.tenantId !== tenantId) throw new NotFoundException('Group not found');

    await this.roleAssignment.removeFromGroup({ groupId, roleId });
  }
}
