import { Logger, NotFoundException } from '@nestjs/common';
import { UserCommandPort } from '../ports/user-command.port';
import { CreateUserDto, UpdateUserDto } from '@application/dto';
import { UserWriteRepositoryPort } from '../ports/user-write-repository.port';
import { RoleRepository, RoleAssignmentRepository } from '@domain/repositories';

export class UserCommandHandler implements UserCommandPort {
  private readonly logger = new Logger(UserCommandHandler.name);

  constructor(
    private readonly userWriteRepo: UserWriteRepositoryPort,
    private readonly roleRepo: RoleRepository,
    private readonly roleAssignment: RoleAssignmentRepository,
  ) {}

  createUser(_tenantId: string, _dto: CreateUserDto): Promise<{ id: string }> {
    throw new Error('Method not implemented.');
  }

  updateUser(_tenantId: string, _id: string, _dto: UpdateUserDto): Promise<void> {
    throw new Error('Method not implemented.');
  }

  deleteUser(_tenantId: string, _id: string): Promise<void> {
    throw new Error('Method not implemented.');
  }

  async assignRole(tenantId: string, userId: string, roleId: string): Promise<void> {
    this.logger.log(`Assigning role=${roleId} to user=${userId} in tenant=${tenantId}`);

    const user = await this.userWriteRepo.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    if (user.tenantId !== tenantId) throw new NotFoundException('User not found');

    const role = await this.roleRepo.findById(roleId);
    if (!role) throw new NotFoundException('Role not found');
    if (role.tenantId !== tenantId) throw new NotFoundException('Role not found');

    await this.roleAssignment.assignToUser({ userId, roleId });
  }

  async removeRole(tenantId: string, userId: string, roleId: string): Promise<void> {
    this.logger.log(`Removing role=${roleId} from user=${userId} in tenant=${tenantId}`);

    const user = await this.userWriteRepo.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    if (user.tenantId !== tenantId) throw new NotFoundException('User not found');

    await this.roleAssignment.removeFromUser({ userId, roleId });
  }
}
