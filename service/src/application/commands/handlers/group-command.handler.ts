import { Injectable, ConflictException, Logger, NotFoundException } from '@nestjs/common';
import { GroupCommandPort } from '../ports/group-command.port';
import { CreateGroupDto, UpdateGroupDto } from '@application/dto';
import { GroupRepository, RoleRepository, RoleAssignmentRepository } from '@domain/repositories';
import { GroupModel } from '@domain/models/group';
import { orThrow } from '@domain/utils';

@Injectable()
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

    const group = orThrow(
      await this.groupRepo.findById(id),
      new NotFoundException('Group not found'),
      (g) => g.tenantId === tenantId,
    );

    if (dto.name) group.changeName(dto.name);
    if (dto.parentId !== undefined) group.changeParent(dto.parentId);

    await this.groupRepo.save(group);
  }

  async deleteGroup(tenantId: string, id: string): Promise<void> {
    this.logger.log(`Deleting group id=${id} in tenant=${tenantId}`);

    orThrow(
      await this.groupRepo.findById(id),
      new NotFoundException('Group not found'),
      (g) => g.tenantId === tenantId,
    );

    await this.groupRepo.delete(id);
  }

  async assignRole(tenantId: string, groupId: string, roleId: string): Promise<void> {
    this.logger.log(`Assigning role=${roleId} to group=${groupId} in tenant=${tenantId}`);

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

    const alreadyAssigned = await this.roleAssignment.existsForGroup({ groupId, roleId });
    if (alreadyAssigned) return;

    await this.roleAssignment.assignToGroup({ groupId, roleId });
  }

  async removeRole(tenantId: string, groupId: string, roleId: string): Promise<void> {
    this.logger.log(`Removing role=${roleId} from group=${groupId} in tenant=${tenantId}`);

    orThrow(
      await this.groupRepo.findById(groupId),
      new NotFoundException('Group not found'),
      (g) => g.tenantId === tenantId,
    );

    await this.roleAssignment.removeFromGroup({ groupId, roleId });
  }
}
