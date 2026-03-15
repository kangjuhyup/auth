import { Module } from '@nestjs/common';
import { InfrastructureModule } from '@infrastructure/infrastructure.module';

// Command Ports
import { AuthCommandPort } from './commands/ports/auth-command.port';
import { TenantCommandPort } from './commands/ports/tenant-command.port';

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
import { AdminQueryPort } from './queries/ports/admin-query.port';
import { AdminQueryHandler } from './queries/handlers/admin-query.handler';
import { AuthQueryPort } from './queries/ports/auth-query.port';
import { AuthQueryHandler } from './queries/handlers/auth-query.handler';
import { UserQueryPort } from './queries/ports/user-query.port';
import { UserQueryHandler } from './queries/handlers/user-query.handler';
import { ClientQueryPort } from './queries/ports/client-query.port';

// Domain Repositories
import { ClientCommandPort } from './commands/ports/client-command.port';
import { ClientCommandHandler } from './commands/handlers/client-command.handler';
import { ClientQueryHandler } from './queries/handlers/client-query.handler';
import { KeyCommandPort } from './commands/ports/key-command.port';
import { KeyCommandHandler } from './commands/handlers/key-command.handler';
import { PolicyCommandPort } from './commands/ports/policy-command.port';
import { PolicyCommandHandler } from './commands/handlers/policy-command.handler';

const commands = [
  {
    provide: AuthCommandPort,
    useClass: AuthCommandHandler,
  },
  {
    provide: TenantCommandPort,
    useClass: TenantCommandHandler,
  },
  {
    provide: GroupCommandPort,
    useClass: GroupCommandHandler,
  },
  {
    provide: UserCommandPort,
    useClass: UserCommandHandler,
  },
  {
    provide: RoleCommandPort,
    useClass: RoleCommandHandler,
  },
  {
    provide: PermissionCommandPort,
    useClass: PermissionCommandHandler,
  },
  {
    provide: ClientCommandPort,
    useClass: ClientCommandHandler,
  },
  {
    provide: KeyCommandPort,
    useClass: KeyCommandHandler,
  },
  {
    provide: PolicyCommandPort,
    useClass: PolicyCommandHandler,
  },
];

const queries = [
  {
    provide: AdminQueryPort,
    useClass: AdminQueryHandler,
  },
  {
    provide: AuthQueryPort,
    useClass: AuthQueryHandler,
  },
  {
    provide: UserQueryPort,
    useClass: UserQueryHandler,
  },
  {
    provide: ClientQueryPort,
    useClass: ClientQueryHandler,
  },
];

@Module({
  imports: [InfrastructureModule],
  providers: [...commands, ...queries],
  exports: [...commands, ...queries],
})
export class ApplicationModule {}
