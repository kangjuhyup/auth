import { Module } from '@nestjs/common';
import { InfrastructureModule } from '@infrastructure/infrastructure.module';

// Command Ports
import { AuthCommandPort } from './commands/ports/auth-command.port';
import { TenantCommandPort } from './commands/ports/tenant-command.port';
import { UserWriteRepositoryPort } from './commands/ports/user-write-repository.port';

// Command Handlers
import { AuthCommandHandler } from './commands/handlers/auth-command.handler';
import { TenantCommandHandler } from './commands/handlers/tenant-command.handler';
import { GroupCommandPort } from './commands/ports/group-command.port';
import { GroupCommandHandler } from './commands/handlers/group-command.handler';
import { UserCommandPort } from './commands/ports/user-command.port';
import { UserCommandHandler } from './commands/handlers/user-command.handler';
import { RoleCommandPort } from './commands/ports/role-command.port';
import { RoleCommandHandler } from './commands/handlers/role-command.handler';
import { PermissionCommandPort } from './commands/ports/permission-command.port';
import { PermissionCommandHandler } from './commands/handlers/permission-command.handler';

// Infrastructure Ports
import { PasswordHashPort } from './ports/password-hash.port';
import { OtpHashPort } from './ports/otp-hash.port';
import { OtpTokenPort } from './ports/otp-token.port';
import { NotificationPort } from './ports/notification.port';
import { AdminQueryPort } from './queries/ports/admin-query.port';
import { AdminQueryHandler } from './queries/handlers/admin-query.handler';
import { UserQueryPort } from './queries/ports/user-query.port';
import { UserQueryService } from './queries/handlers/user-query.handler';
import { ClientQueryPort } from './queries/ports/client-query.port';

// Domain Repositories
import { TenantRepository, GroupRepository, RoleRepository, PermissionRepository, RoleAssignmentRepository, RolePermissionRepository } from '@domain/repositories';

@Module({
  imports: [InfrastructureModule],
  providers: [
    {
      provide: AuthCommandPort,
      useFactory: (userWriteRepo, passwordHash, otpHash, otpToken, notification) => {
        return new AuthCommandHandler(
          userWriteRepo,
          passwordHash,
          otpHash,
          otpToken,
          notification,
        );
      },
      inject: [
        UserWriteRepositoryPort,
        PasswordHashPort,
        OtpHashPort,
        OtpTokenPort,
        NotificationPort,
      ],
    },
    {
      provide: TenantCommandPort,
      useFactory: (tenantRepo: TenantRepository) =>
        new TenantCommandHandler(tenantRepo),
      inject: [TenantRepository],
    },
    {
      provide: GroupCommandPort,
      useFactory: (groupRepo: GroupRepository, roleRepo: RoleRepository, roleAssignment: RoleAssignmentRepository) =>
        new GroupCommandHandler(groupRepo, roleRepo, roleAssignment),
      inject: [GroupRepository, RoleRepository, RoleAssignmentRepository],
    },
    {
      provide: UserCommandPort,
      useFactory: (userWriteRepo: UserWriteRepositoryPort, roleRepo: RoleRepository, roleAssignment: RoleAssignmentRepository) =>
        new UserCommandHandler(userWriteRepo, roleRepo, roleAssignment),
      inject: [UserWriteRepositoryPort, RoleRepository, RoleAssignmentRepository],
    },
    {
      provide: RoleCommandPort,
      useFactory: (
        roleRepo: RoleRepository,
        permissionRepo: PermissionRepository,
        rolePermissionRepo: RolePermissionRepository,
      ) => new RoleCommandHandler(roleRepo, permissionRepo, rolePermissionRepo),
      inject: [RoleRepository, PermissionRepository, RolePermissionRepository],
    },
    {
      provide: PermissionCommandPort,
      useFactory: (permissionRepo: PermissionRepository) =>
        new PermissionCommandHandler(permissionRepo),
      inject: [PermissionRepository],
    },
    {
      provide: AdminQueryPort,
      useFactory: (
        tenantRepo: TenantRepository,
        groupRepo: GroupRepository,
        roleRepo: RoleRepository,
        permissionRepo: PermissionRepository,
        rolePermissionRepo: RolePermissionRepository,
      ) => new AdminQueryHandler(tenantRepo, groupRepo, roleRepo, permissionRepo, rolePermissionRepo),
      inject: [TenantRepository, GroupRepository, RoleRepository, PermissionRepository, RolePermissionRepository],
    },
    {
      provide: UserQueryPort,
      useClass: UserQueryService,
    },
    {
      provide: ClientQueryPort,
      useValue: { getAllowedResources: async () => [] },
    },
  ],
  exports: [AuthCommandPort, TenantCommandPort, UserCommandPort, GroupCommandPort, RoleCommandPort, PermissionCommandPort, AdminQueryPort, UserQueryPort],
})
export class ApplicationModule {}
