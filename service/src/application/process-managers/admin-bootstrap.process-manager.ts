import type { ClientCommandPort } from '@application/commands/ports/client-command.port';
import type { RoleCommandPort } from '@application/commands/ports/role-command.port';
import type { TenantCommandPort } from '@application/commands/ports/tenant-command.port';
import type { UserCommandPort } from '@application/commands/ports/user-command.port';
import type { UserWriteRepositoryPort } from '@application/commands/ports/user-write-repository.port';
import {
  AuditContext,
  CreateClientDto,
  CreateRoleDto,
  CreateTenantDto,
  CreateUserDto,
} from '@application/dto';
import type { ClientModel } from '@domain/models/client';
import type { RoleModel } from '@domain/models/role';
import {
  BUILT_IN_OIDC_SCOPES,
  type BuiltInOidcScope,
} from '@domain/models/scope';
import type { TenantModel } from '@domain/models/tenant';
import type { UserModel } from '@domain/models/user';
import type {
  ClientRepository,
  RoleAssignmentRepository,
  RoleRepository,
  ScopeRepository,
  TenantRepository,
} from '@domain/repositories';
import {
  BootstrapStepRunner,
  createBootstrapKnownFailure,
} from './bootstrap-step-runner';
import {
  AdminBootstrapPort,
  type AdminBootstrapInput,
} from './ports/admin-bootstrap.port';

const PROCESS_KEY = 'bootstrap:admin:v1';
const STEPS = [
  'tenant',
  'role',
  'user',
  'role-assignment',
  'client',
  'completed',
] as const;

export class AdminBootstrapProcessManager implements AdminBootstrapPort {
  constructor(
    private readonly runner: BootstrapStepRunner,
    private readonly tenantCommand: TenantCommandPort,
    private readonly userCommand: UserCommandPort,
    private readonly roleCommand: RoleCommandPort,
    private readonly clientCommand: ClientCommandPort,
    private readonly tenantRepository: TenantRepository,
    private readonly scopeRepository: ScopeRepository,
    private readonly userRepository: UserWriteRepositoryPort,
    private readonly roleRepository: RoleRepository,
    private readonly assignmentRepository: RoleAssignmentRepository,
    private readonly clientRepository: ClientRepository,
  ) {}

  async bootstrap(input: AdminBootstrapInput): Promise<void> {
    const auditContext = AuditContext.of({ correlationId: PROCESS_KEY });

    await this.runner.run({
      processKey: PROCESS_KEY,
      initialStep: 'tenant',
      expectedStep: 'tenant',
      nextStep: 'role',
      steps: STEPS,
      work: async () => {
        const existing = await this.tenantRepository.findByCode('master');
        if (existing) {
          this.assertMasterTenant(existing);
          const existingScopes = await this.scopeRepository.findByNames(
            existing.id,
            [...BUILT_IN_OIDC_SCOPES],
          );
          const existingScopeNames = new Set<string>();
          for (const scope of existingScopes) {
            if (
              scope.tenantId !== existing.id ||
              !this.isBuiltInScopeName(scope.name) ||
              !scope.builtIn ||
              existingScopeNames.has(scope.name)
            ) {
              throw new Error('Bootstrap lookup identity mismatch');
            }
            existingScopeNames.add(scope.name);
          }
          const missingScopes = BUILT_IN_OIDC_SCOPES.filter(
            (scope) => !existingScopeNames.has(scope),
          );
          if (missingScopes.length > 0) {
            await this.tenantCommand.ensureBuiltInScopes(
              existing.id,
              missingScopes,
              auditContext,
            );
          }
          return;
        }

        await this.tenantCommand.createTenant(
          CreateTenantDto.of({ code: 'master', name: 'Master' }),
          auditContext,
        );
      },
    });

    await this.runner.run({
      processKey: PROCESS_KEY,
      initialStep: 'tenant',
      expectedStep: 'role',
      nextStep: 'user',
      steps: STEPS,
      work: async () => {
        const tenant = await this.requireMasterTenant();
        if (await this.findSuperAdminRole(tenant.id)) {
          return;
        }

        await this.roleCommand.createRole(
          tenant.id,
          CreateRoleDto.of({
            code: 'SUPER_ADMIN',
            name: 'Super Admin',
            description: '플랫폼 최고 관리자',
          }),
          auditContext,
        );
      },
    });

    await this.runner.run({
      processKey: PROCESS_KEY,
      initialStep: 'tenant',
      expectedStep: 'user',
      nextStep: 'role-assignment',
      steps: STEPS,
      work: async () => {
        const tenant = await this.requireMasterTenant();
        if (await this.findAdminUser(tenant.id, input.username)) {
          return;
        }
        if (!input.password) {
          throw createBootstrapKnownFailure('ADMIN_CREDENTIALS_REQUIRED');
        }

        await this.userCommand.createUser(
          tenant.id,
          CreateUserDto.of({
            username: input.username,
            password: input.password,
            temporaryPassword: true,
            email: 'admin@localhost',
          }),
          auditContext,
        );
      },
    });

    await this.runner.run({
      processKey: PROCESS_KEY,
      initialStep: 'tenant',
      expectedStep: 'role-assignment',
      nextStep: 'client',
      steps: STEPS,
      work: async () => {
        const tenant = await this.requireMasterTenant();
        const user = await this.requireAdminUser(tenant.id, input.username);
        const role = await this.requireSuperAdminRole(tenant.id);
        if (
          await this.assignmentRepository.existsForUser({
            userId: user.id,
            roleId: role.id,
          })
        ) {
          return;
        }

        await this.userCommand.assignRole(
          tenant.id,
          user.id,
          role.id,
          auditContext,
        );
      },
    });

    await this.runner.run({
      processKey: PROCESS_KEY,
      initialStep: 'tenant',
      expectedStep: 'client',
      nextStep: 'completed',
      steps: STEPS,
      work: async () => {
        const tenant = await this.requireMasterTenant();
        const existing = await this.clientRepository.findByClientId(
          tenant.id,
          '__admin-portal__',
        );
        if (existing) {
          if (!this.isCompatiblePortal(existing, tenant.id, input.adminUiUrl)) {
            throw createBootstrapKnownFailure('ADMIN_PORTAL_CONFLICT');
          }
          return;
        }

        await this.clientCommand.createClient(
          tenant.id,
          this.createPortalDto(input.adminUiUrl),
          auditContext,
        );
      },
    });

    await this.runner.complete({
      processKey: PROCESS_KEY,
      initialStep: 'tenant',
      expectedStep: 'completed',
      steps: STEPS,
    });
  }

  private async requireMasterTenant(): Promise<TenantModel> {
    const tenant = await this.tenantRepository.findByCode('master');
    if (!tenant) {
      throw new Error('Bootstrap prerequisite missing');
    }
    this.assertMasterTenant(tenant);
    return tenant;
  }

  private assertMasterTenant(tenant: TenantModel): void {
    if (tenant.code !== 'master') {
      throw new Error('Bootstrap lookup identity mismatch');
    }
  }

  private isBuiltInScopeName(name: string): name is BuiltInOidcScope {
    return (BUILT_IN_OIDC_SCOPES as readonly string[]).includes(name);
  }

  private async findSuperAdminRole(
    tenantId: string,
  ): Promise<RoleModel | null> {
    const role = await this.roleRepository.findByCode(tenantId, 'SUPER_ADMIN');
    if (role && (role.tenantId !== tenantId || role.code !== 'SUPER_ADMIN')) {
      throw new Error('Bootstrap lookup identity mismatch');
    }
    return role;
  }

  private async requireSuperAdminRole(tenantId: string): Promise<RoleModel> {
    const role = await this.findSuperAdminRole(tenantId);
    if (!role) {
      throw new Error('Bootstrap prerequisite missing');
    }
    return role;
  }

  private async findAdminUser(
    tenantId: string,
    username: string,
  ): Promise<UserModel | undefined> {
    const user = await this.userRepository.findByUsername(tenantId, username);
    if (user && (user.tenantId !== tenantId || user.username !== username)) {
      throw new Error('Bootstrap lookup identity mismatch');
    }
    if (
      user &&
      (user.status !== 'ACTIVE' ||
        user.passwordCredential?.type !== 'password' ||
        !user.passwordCredential.enabled)
    ) {
      throw createBootstrapKnownFailure('ADMIN_USER_CONFLICT');
    }
    return user;
  }

  private async requireAdminUser(
    tenantId: string,
    username: string,
  ): Promise<UserModel> {
    const user = await this.findAdminUser(tenantId, username);
    if (!user) {
      throw new Error('Bootstrap prerequisite missing');
    }
    return user;
  }

  private createPortalDto(adminUiUrl: string): CreateClientDto {
    return CreateClientDto.of({
      clientId: '__admin-portal__',
      name: 'Admin Portal',
      type: 'confidential',
      redirectUris: [`${adminUiUrl}/admin/tenants`],
      grantTypes: ['authorization_code'],
      responseTypes: ['code'],
      tokenEndpointAuthMethod: 'none',
      scope: 'openid profile',
      postLogoutRedirectUris: [`${adminUiUrl}/login`],
      applicationType: 'web',
      skipConsent: true,
    });
  }

  private isCompatiblePortal(
    client: ClientModel,
    tenantId: string,
    adminUiUrl: string,
  ): boolean {
    return (
      client.tenantId === tenantId &&
      client.clientId === '__admin-portal__' &&
      client.secretEnc == null &&
      client.name === 'Admin Portal' &&
      client.type === 'confidential' &&
      client.enabled &&
      this.sameValues(client.redirectUris, [`${adminUiUrl}/admin/tenants`]) &&
      this.sameValues(client.grantTypes, ['authorization_code']) &&
      this.sameValues(client.responseTypes, ['code']) &&
      client.tokenEndpointAuthMethod === 'none' &&
      client.scope === 'openid profile' &&
      this.sameValues(client.postLogoutRedirectUris, [`${adminUiUrl}/login`]) &&
      client.applicationType === 'web' &&
      client.backchannelLogoutUri == null &&
      client.frontchannelLogoutUri == null &&
      this.sameValues(client.allowedResources, []) &&
      client.skipConsent &&
      client.accessTokenTtlSec == null &&
      client.refreshTokenTtlSec == null
    );
  }

  private sameValues(actual: readonly string[], expected: readonly string[]) {
    return (
      actual.length === expected.length &&
      actual.every((value, index) => value === expected[index])
    );
  }
}
