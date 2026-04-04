import { Logger, NotFoundException } from '@nestjs/common';
import { UserCommandPort } from '../ports/user-command.port';
import { CreateUserDto, UpdateUserDto } from '@application/dto';
import { UserWriteRepositoryPort } from '../ports/user-write-repository.port';
import { RoleRepository, RoleAssignmentRepository } from '@domain/repositories';
import { PasswordHashPort } from '@application/ports/password-hash.port';
import { UserModel } from '@domain/models/user';
import { UserCredentialModel } from '@domain/models/user-credential';
import { orThrow } from '@domain/utils';
import { ulid } from 'ulid';

export class UserCommandHandler implements UserCommandPort {
  private readonly logger = new Logger(UserCommandHandler.name);

  constructor(
    private readonly userWriteRepo: UserWriteRepositoryPort,
    private readonly roleRepo: RoleRepository,
    private readonly roleAssignment: RoleAssignmentRepository,
    private readonly passwordHash: PasswordHashPort,
  ) {}

  async createUser(tenantId: string, dto: CreateUserDto): Promise<{ id: string }> {
    this.logger.log(`Creating user in tenant=${tenantId}`);

    const existing = await this.userWriteRepo.findByUsername(tenantId, dto.username);
    if (existing) throw new Error('UsernameAlreadyExists');

    const userId = ulid();
    const hashResult = await this.passwordHash.hash(dto.password);
    const credential = UserCredentialModel.password({
      secretHash: hashResult.hash,
      hashAlg: hashResult.alg,
      hashParams: hashResult.params,
      hashVersion: hashResult.version,
    });

    const user = UserModel.create({
      id: userId,
      tenantId,
      username: dto.username,
      email: dto.email,
      phone: dto.phone,
      passwordCredential: credential,
    });

    if (dto.status && dto.status !== 'ACTIVE') {
      user.changeStatus(dto.status);
    }

    await this.userWriteRepo.save(user);
    return { id: userId };
  }

  async updateUser(tenantId: string, id: string, dto: UpdateUserDto): Promise<void> {
    this.logger.log(`Updating user=${id} in tenant=${tenantId}`);

    const user = orThrow(
      await this.userWriteRepo.findById(id),
      new NotFoundException('User not found'),
      (u) => u.tenantId === tenantId,
    );

    if (dto.email !== undefined) {
      user.changeEmail(dto.email ?? null);
    }
    if (dto.phone !== undefined) {
      user.changePhone(dto.phone ?? null);
    }
    if (dto.status !== undefined) {
      user.changeStatus(dto.status);
    }

    await this.userWriteRepo.save(user);
  }

  async deleteUser(tenantId: string, id: string): Promise<void> {
    this.logger.log(`Deleting user=${id} in tenant=${tenantId}`);

    const user = orThrow(
      await this.userWriteRepo.findById(id),
      new NotFoundException('User not found'),
      (u) => u.tenantId === tenantId,
    );

    user.withdraw();
    await this.userWriteRepo.save(user);
  }

  async assignRole(tenantId: string, userId: string, roleId: string): Promise<void> {
    this.logger.log(`Assigning role=${roleId} to user=${userId} in tenant=${tenantId}`);

    orThrow(
      await this.userWriteRepo.findById(userId),
      new NotFoundException('User not found'),
      (u) => u.tenantId === tenantId,
    );

    orThrow(
      await this.roleRepo.findById(roleId),
      new NotFoundException('Role not found'),
      (r) => r.tenantId === tenantId,
    );

    await this.roleAssignment.assignToUser({ userId, roleId });
  }

  async removeRole(tenantId: string, userId: string, roleId: string): Promise<void> {
    this.logger.log(`Removing role=${roleId} from user=${userId} in tenant=${tenantId}`);

    orThrow(
      await this.userWriteRepo.findById(userId),
      new NotFoundException('User not found'),
      (u) => u.tenantId === tenantId,
    );

    await this.roleAssignment.removeFromUser({ userId, roleId });
  }
}
