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
import type {
  ClientRepository,
  RoleAssignmentRepository,
  RoleRepository,
  TenantRepository,
} from '@domain/repositories';
import {
  BootstrapKnownFailure,
  BootstrapStepRunner,
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
        if (await this.tenantRepository.findByCode('master')) {
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
        if (await this.roleRepository.findByCode(tenant.id, 'SUPER_ADMIN')) {
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
        if (
          await this.userRepository.findByUsername(tenant.id, input.username)
        ) {
          return;
        }
        if (!input.password) {
          throw BootstrapKnownFailure.of('ADMIN_CREDENTIALS_REQUIRED');
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
        const user = await this.userRepository.findByUsername(
          tenant.id,
          input.username,
        );
        const role = await this.roleRepository.findByCode(
          tenant.id,
          'SUPER_ADMIN',
        );
        if (!user || !role) {
          throw new Error('Bootstrap prerequisite missing');
        }
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
            throw BootstrapKnownFailure.of('ADMIN_PORTAL_CONFLICT');
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

  private async requireMasterTenant() {
    const tenant = await this.tenantRepository.findByCode('master');
    if (!tenant) {
      throw new Error('Bootstrap prerequisite missing');
    }
    return tenant;
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
