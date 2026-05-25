import 'reflect-metadata';
import {
  Logger,
  type INestApplication,
  type InjectionToken,
  type Provider,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { AccessVerifierPort } from '@application/ports/access-verifier.port';
import { AdminSessionPort } from '@application/ports/admin-session.port';
import { InteractionCommandPort } from '@application/ports/interaction-command.port';
import { AuthCommandPort } from '@application/commands/ports/auth-command.port';
import { ClientCommandPort } from '@application/commands/ports/client-command.port';
import { GroupCommandPort } from '@application/commands/ports/group-command.port';
import { IdentityProviderCommandPort } from '@application/commands/ports/identity-provider-command.port';
import { KeyCommandPort } from '@application/commands/ports/key-command.port';
import { PermissionCommandPort } from '@application/commands/ports/permission-command.port';
import { PolicyCommandPort } from '@application/commands/ports/policy-command.port';
import { RoleCommandPort } from '@application/commands/ports/role-command.port';
import { TenantCommandPort } from '@application/commands/ports/tenant-command.port';
import { UserCommandPort } from '@application/commands/ports/user-command.port';
import { AdminQueryPort, AuthQueryPort } from '@application/queries/ports';
import { ObservabilityQueryPort } from '@application/queries/ports/observability-query.port';
import { AdminAuditLogController } from '@presentation/controllers/admin/audit-log.controller';
import { AdminClientController } from '@presentation/controllers/admin/client.controller';
import { AdminGroupController } from '@presentation/controllers/admin/group.controller';
import { AdminIdentityProviderController } from '@presentation/controllers/admin/identity-provider.controller';
import { AdminKeyController } from '@presentation/controllers/admin/key.controller';
import { AdminPermissionController } from '@presentation/controllers/admin/permission.controller';
import { AdminPolicyController } from '@presentation/controllers/admin/policy.controller';
import { AdminRoleController } from '@presentation/controllers/admin/role.controller';
import { AdminSessionController } from '@presentation/controllers/admin/session.controller';
import { AdminTenantController } from '@presentation/controllers/admin/tenant.controller';
import { AdminUserController } from '@presentation/controllers/admin/user.controller';
import { AuthController } from '@presentation/controllers/auth.controller';
import { HealthController } from '@presentation/controllers/health.controller';
import { InteractionController } from '@presentation/controllers/interaction.controller';
import { createOpenApiDocument } from '@presentation/openapi';

const DEFAULT_OUTPUT_PATH = '../docs/static/openapi.json';

function provider(token: InjectionToken): Provider {
  return {
    provide: token,
    useValue: {},
  };
}

async function createDocumentApp(): Promise<{
  app: INestApplication;
  moduleRef: TestingModule;
}> {
  const moduleRef = await Test.createTestingModule({
    controllers: [
      HealthController,
      InteractionController,
      AuthController,
      AdminSessionController,
      AdminAuditLogController,
      AdminClientController,
      AdminGroupController,
      AdminIdentityProviderController,
      AdminKeyController,
      AdminPermissionController,
      AdminPolicyController,
      AdminRoleController,
      AdminTenantController,
      AdminUserController,
    ],
    providers: [
      provider(ObservabilityQueryPort),
      provider(InteractionCommandPort),
      provider(AccessVerifierPort),
      provider(AuthCommandPort),
      provider(AuthQueryPort),
      provider(AdminSessionPort),
      provider(AdminQueryPort),
      provider(ClientCommandPort),
      provider(GroupCommandPort),
      provider(IdentityProviderCommandPort),
      provider(KeyCommandPort),
      provider(PermissionCommandPort),
      provider(PolicyCommandPort),
      provider(RoleCommandPort),
      provider(TenantCommandPort),
      provider(UserCommandPort),
      {
        provide: ConfigService,
        useValue: { get: () => undefined },
      },
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  await app.init();

  return { app, moduleRef };
}

async function main(): Promise<void> {
  Logger.overrideLogger(false);

  const outputPath = resolve(
    process.cwd(),
    process.argv[2] ?? DEFAULT_OUTPUT_PATH,
  );
  const { app, moduleRef } = await createDocumentApp();

  try {
    const document = createOpenApiDocument(app);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
    process.stdout.write(`OpenAPI JSON exported to ${outputPath}\n`);
  } finally {
    await app.close();
    await moduleRef.close();
  }
}

void main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.stack : String(error)}\n`,
  );
  process.exitCode = 1;
});
