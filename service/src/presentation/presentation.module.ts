import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApplicationModule } from '@application/application.module';
import { TenantMiddleware } from './http/tenant.middleware';
import { OidcDelegateMiddleware } from './http/oidc.middleware';
import { CorrelationIdMiddleware } from './http/correlation-id.middleware';
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
import { AdminScopeController } from './controllers/admin/scope.controller';
import { AdminCustomGrantController } from './controllers/admin/custom-grant.controller';
import { AdminGroupController } from './controllers/admin/group.controller';
import { AdminSessionController } from './controllers/admin/session.controller';
import { AdminIdentityProviderController } from './controllers/admin/identity-provider.controller';
import { InteractionController } from './controllers/interaction.controller';
import { AdminGuard } from './http/admin.guard';
import { AccessGuard } from './http/access.guard';

@Module({
  imports: [ConfigModule, ApplicationModule],
  providers: [AdminGuard, AccessGuard, OidcDelegateMiddleware],
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
    AdminScopeController,
    AdminCustomGrantController,
    AdminGroupController,
    AdminSessionController,
    AdminIdentityProviderController,
    InteractionController,
  ],
})
export class PresentationModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CorrelationIdMiddleware)
      .forRoutes({ path: '*path', method: RequestMethod.ALL });

    consumer.apply(TenantMiddleware, OidcDelegateMiddleware).forRoutes(
      {
        path: 't/:tenantCode/oidc',
        method: RequestMethod.ALL,
      },
      {
        path: 't/:tenantCode/oidc/*path',
        method: RequestMethod.ALL,
      },
    );

    consumer
      .apply(TenantMiddleware)
      .forRoutes(AuthController, InteractionController, {
        path: 't/:tenantCode/admin/*path',
        method: RequestMethod.ALL,
      });
  }
}
