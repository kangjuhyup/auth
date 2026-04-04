import { Module } from '@nestjs/common';
import { ApplicationModule } from '@application/application.module';
import { HealthController } from './controllers/health.controller';
import { AuthController } from './controllers/auth.controller';
import { AdminClientController } from './controllers/admin/client.controller';
import { AdminKeyController } from './controllers/admin/key.controller';
import { AdminPolicyController } from './controllers/admin/policy.controller';
import { AdminAuditLogController } from './controllers/admin/audit-log.controller';
import { AdminTenantController } from './controllers/admin/tenant.controller';
import { AdminUserController } from './controllers/admin/user.controller';
import { AdminRoleController } from './controllers/admin/role.controller';
import { AdminPermissionController } from './controllers/admin/permission.controller';
import { AdminGroupController } from './controllers/admin/group.controller';
import { AdminSessionController } from './controllers/admin/session.controller';
import { InteractionController } from './controllers/interaction.controller';

@Module({
  imports: [ApplicationModule],
  controllers: [
    HealthController,
    AuthController,
    AdminClientController,
    AdminKeyController,
    AdminPolicyController,
    AdminAuditLogController,
    AdminTenantController,
    AdminUserController,
    AdminRoleController,
    AdminPermissionController,
    AdminGroupController,
    AdminSessionController,
    InteractionController,
  ],
})
export class PresentationModule {}
