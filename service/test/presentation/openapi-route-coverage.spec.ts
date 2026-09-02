import { INestApplication, InjectionToken, Provider } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { createOpenApiDocument } from '@presentation/openapi';
import { HealthController } from '@presentation/controllers/health.controller';
import { InteractionController } from '@presentation/controllers/interaction.controller';
import { AuthController } from '@presentation/controllers/auth.controller';
import { AdminSessionController } from '@presentation/controllers/admin/session.controller';
import { AdminAuditLogController } from '@presentation/controllers/admin/audit-log.controller';
import { AdminClientController } from '@presentation/controllers/admin/client.controller';
import { AdminCustomGrantController } from '@presentation/controllers/admin/custom-grant.controller';
import { AdminGroupController } from '@presentation/controllers/admin/group.controller';
import { AdminIdentityProviderController } from '@presentation/controllers/admin/identity-provider.controller';
import { AdminKeyController } from '@presentation/controllers/admin/key.controller';
import { AdminPermissionController } from '@presentation/controllers/admin/permission.controller';
import { AdminPolicyController } from '@presentation/controllers/admin/policy.controller';
import { AdminRoleController } from '@presentation/controllers/admin/role.controller';
import { AdminScopeController } from '@presentation/controllers/admin/scope.controller';
import { AdminTenantController } from '@presentation/controllers/admin/tenant.controller';
import { AdminUserController } from '@presentation/controllers/admin/user.controller';
import { ObservabilityQueryPort } from '@application/queries/ports/observability-query.port';
import { InteractionCommandPort } from '@application/ports/interaction-command.port';
import { AccessVerifierPort } from '@application/ports/access-verifier.port';
import { AuthCommandPort } from '@application/commands/ports/auth-command.port';
import { AuthQueryPort } from '@application/queries/ports';
import { AdminSessionPort } from '@application/ports/admin-session.port';
import { AdminQueryPort } from '@application/queries/ports';
import { ClientCommandPort } from '@application/commands/ports/client-command.port';
import { CustomGrantCommandPort } from '@application/commands/ports/custom-grant-command.port';
import { GroupCommandPort } from '@application/commands/ports/group-command.port';
import { IdentityProviderCommandPort } from '@application/commands/ports/identity-provider-command.port';
import { KeyCommandPort } from '@application/commands/ports/key-command.port';
import { PermissionCommandPort } from '@application/commands/ports/permission-command.port';
import { PolicyCommandPort } from '@application/commands/ports/policy-command.port';
import { RoleCommandPort } from '@application/commands/ports/role-command.port';
import { ScopeCommandPort } from '@application/commands/ports/scope-command.port';
import { TenantCommandPort } from '@application/commands/ports/tenant-command.port';
import { UserCommandPort } from '@application/commands/ports/user-command.port';

type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch';

type RouteOperation = {
  method: HttpMethod;
  path: string;
  source: string;
};

const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch'] as const;
const METHOD_DECORATOR = /@(Get|Post|Put|Delete|Patch)(?:\(([^)]*)\))?/g;
const CONTROLLER_DECORATOR = /@Controller(?:\(([^)]*)\))?/;
const STRING_LITERAL = /['"`]([^'"`]*)['"`]/;
const BODYLESS_STATUSES = new Set(['204', '302', '304']);

function provider(token: InjectionToken): Provider {
  return {
    provide: token,
    useValue: {},
  };
}

function controllerFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      return controllerFiles(path);
    }
    return path.endsWith('.controller.ts') ? [path] : [];
  });
}

function decoratorPath(args: string | undefined): string {
  if (!args) {
    return '';
  }
  return STRING_LITERAL.exec(args)?.[1] ?? '';
}

function normalizePath(basePath: string, routePath: string): string {
  const path = [basePath, routePath]
    .map((part) => part.trim().replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/')
    .replace(/:([^/]+)/g, '{$1}');
  return `/${path}`;
}

function scanControllerRoutes(): RouteOperation[] {
  const controllerDir = resolve(
    __dirname,
    '../../src/presentation/controllers',
  );
  return controllerFiles(controllerDir).flatMap((file) => {
    const source = readFileSync(file, 'utf8');
    const controllerArgs = CONTROLLER_DECORATOR.exec(source)?.[1];
    const basePath = decoratorPath(controllerArgs);
    const sourceName = relative(controllerDir, file);
    const routes: RouteOperation[] = [];

    for (const match of source.matchAll(METHOD_DECORATOR)) {
      const method = match[1].toLowerCase() as HttpMethod;
      const routePath = decoratorPath(match[2]);
      routes.push({
        method,
        path: normalizePath(basePath, routePath),
        source: sourceName,
      });
    }

    return routes;
  });
}

function operationEntries(document: { paths: Record<string, any> }) {
  return Object.entries(document.paths).flatMap(([path, pathItem]) =>
    Object.entries(pathItem)
      .filter(([method]) => HTTP_METHODS.includes(method as HttpMethod))
      .map(([method, operation]) => ({
        method,
        path,
        operation: operation as { responses?: Record<string, any> },
      })),
  );
}

describe('openapi route coverage', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let document: ReturnType<typeof createOpenApiDocument>;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      controllers: [
        HealthController,
        InteractionController,
        AuthController,
        AdminSessionController,
        AdminAuditLogController,
        AdminClientController,
        AdminCustomGrantController,
        AdminGroupController,
        AdminIdentityProviderController,
        AdminKeyController,
        AdminPermissionController,
        AdminPolicyController,
        AdminRoleController,
        AdminScopeController,
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
        provider(CustomGrantCommandPort),
        provider(GroupCommandPort),
        provider(IdentityProviderCommandPort),
        provider(KeyCommandPort),
        provider(PermissionCommandPort),
        provider(PolicyCommandPort),
        provider(RoleCommandPort),
        provider(ScopeCommandPort),
        provider(TenantCommandPort),
        provider(UserCommandPort),
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    document = createOpenApiDocument(app);
  });

  afterAll(async () => {
    await app?.close();
    await moduleRef?.close();
  });

  it('presentation controller의 모든 HTTP route가 OpenAPI document에 포함된다', () => {
    const documented = new Set(
      operationEntries(document).map(({ method, path }) => `${method} ${path}`),
    );

    const missing = scanControllerRoutes()
      .filter((route) => !documented.has(`${route.method} ${route.path}`))
      .map(
        (route) =>
          `${route.method.toUpperCase()} ${route.path} (${route.source})`,
      );

    expect(missing).toEqual([]);
  });

  it('본문을 반환하는 operation은 response content schema를 가진다', () => {
    const missingContent = operationEntries(document)
      .filter(({ operation }) => {
        const responses = Object.entries(operation.responses ?? {});
        return !responses.some(
          ([status, response]) =>
            BODYLESS_STATUSES.has(status) ||
            Boolean((response as { content?: unknown }).content),
        );
      })
      .map(({ method, path }) => `${method.toUpperCase()} ${path}`);

    expect(missingContent).toEqual([]);
  });

  it('resource server introspection은 HTTP Basic 보안 scheme을 노출한다', () => {
    expect(
      document.components?.securitySchemes?.['resource-server-basic'],
    ).toMatchObject({
      type: 'http',
      scheme: 'basic',
    });
  });

  it('access-token bearer scheme은 runtime token format을 JWT로 고정 표기하지 않는다', () => {
    expect(
      document.components?.securitySchemes?.['access-token'],
    ).toMatchObject({
      type: 'http',
      scheme: 'bearer',
    });
    expect(
      document.components?.securitySchemes?.['access-token'],
    ).not.toHaveProperty('bearerFormat');
  });
});
