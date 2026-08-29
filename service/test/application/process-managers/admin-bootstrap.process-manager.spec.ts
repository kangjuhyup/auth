import { ClientCommandPort } from '@application/commands/ports/client-command.port';
import { RoleCommandPort } from '@application/commands/ports/role-command.port';
import { TenantCommandPort } from '@application/commands/ports/tenant-command.port';
import { UserCommandPort } from '@application/commands/ports/user-command.port';
import { UserWriteRepositoryPort } from '@application/commands/ports/user-write-repository.port';
import {
  AuditContext,
  CreateClientDto,
  CreateRoleDto,
  CreateTenantDto,
  CreateUserDto,
} from '@application/dto';
import { AdminBootstrapProcessManager } from '@application/process-managers/admin-bootstrap.process-manager';
import { BootstrapProcessState } from '@application/process-managers/bootstrap-process-state';
import { BootstrapStepRunner } from '@application/process-managers/bootstrap-step-runner';
import type { AdminBootstrapInput } from '@application/process-managers/ports/admin-bootstrap.port';
import type { BootstrapProcessRepository } from '@application/process-managers/ports/bootstrap-process.repository';
import { ClientModel } from '@domain/models/client';
import { RoleModel } from '@domain/models/role';
import { TenantModel } from '@domain/models/tenant';
import { UserModel } from '@domain/models/user';
import type {
  ClientRepository,
  RoleAssignmentRepository,
  RoleRepository,
  TenantRepository,
} from '@domain/repositories';

describe('AdminBootstrapProcessManager', () => {
  const processKey = 'bootstrap:admin:v1';
  const steps = [
    'tenant',
    'role',
    'user',
    'role-assignment',
    'client',
    'completed',
  ] as const;
  const input: AdminBootstrapInput = {
    username: 'admin',
    password: 'Admin1234!',
    adminUiUrl: 'http://localhost:5173',
  };
  const auditContext = AuditContext.of({ correlationId: processKey });

  function makeTenant(): TenantModel {
    return new TenantModel({ code: 'master', name: 'Master' }).setPersistence(
      'tenant-master',
      new Date('2026-08-29T00:00:00.000Z'),
      new Date('2026-08-29T00:00:00.000Z'),
    );
  }

  function makeRole(): RoleModel {
    return new RoleModel({
      tenantId: 'tenant-master',
      code: 'SUPER_ADMIN',
      name: 'Super Admin',
      description: '플랫폼 최고 관리자',
    }).setPersistence(
      'role-super-admin',
      new Date('2026-08-29T00:00:00.000Z'),
      new Date('2026-08-29T00:00:00.000Z'),
    );
  }

  function makeUser(username = 'admin'): UserModel {
    return UserModel.of({
      id: 'user-admin',
      tenantId: 'tenant-master',
      username,
      email: 'admin@localhost',
      emailVerified: true,
      phoneVerified: false,
      status: 'ACTIVE',
    });
  }

  function makePortal(
    overrides: Partial<ConstructorParameters<typeof ClientModel>[0]> = {},
  ): ClientModel {
    return new ClientModel({
      tenantId: 'tenant-master',
      clientId: '__admin-portal__',
      secretEnc: null,
      name: 'Admin Portal',
      type: 'confidential',
      enabled: true,
      redirectUris: ['http://localhost:5173/admin/tenants'],
      grantTypes: ['authorization_code'],
      responseTypes: ['code'],
      tokenEndpointAuthMethod: 'none',
      scope: 'openid profile',
      postLogoutRedirectUris: ['http://localhost:5173/login'],
      applicationType: 'web',
      backchannelLogoutUri: null,
      frontchannelLogoutUri: null,
      allowedResources: [],
      skipConsent: true,
      accessTokenTtlSec: null,
      refreshTokenTtlSec: null,
      ...overrides,
    }).setPersistence(
      'client-admin-portal',
      new Date('2026-08-29T00:00:00.000Z'),
      new Date('2026-08-29T00:00:00.000Z'),
    );
  }

  function createSubject(params?: {
    state?: BootstrapProcessState;
    tenant?: TenantModel | null;
    role?: RoleModel | null;
    user?: UserModel;
    assignmentExists?: boolean;
    client?: ClientModel | null;
  }) {
    const state =
      params?.state ?? BootstrapProcessState.start(processKey, 'tenant');
    let tenant = params?.tenant === undefined ? makeTenant() : params.tenant;
    let role = params?.role === undefined ? makeRole() : params.role;
    let user = params?.user;
    let client = params?.client === undefined ? makePortal() : params.client;
    let assignmentExists = params?.assignmentExists ?? true;

    const processRepository = {
      withLockedState: jest.fn(async (_params, work) => work(state)),
    } as jest.Mocked<BootstrapProcessRepository>;
    const runner = new BootstrapStepRunner(processRepository);
    const tenantRepository = {
      findByCode: jest.fn(async () => tenant),
      findById: jest.fn(),
      list: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<TenantRepository>;
    const roleRepository = {
      findById: jest.fn(),
      findByCode: jest.fn(async () => role),
      list: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<RoleRepository>;
    const userRepository = {
      findById: jest.fn(),
      findByUsername: jest.fn(async () => user),
      findByContact: jest.fn(),
      list: jest.fn(),
      save: jest.fn(),
      findCredentialsByType: jest.fn(),
      createCredential: jest.fn(),
      saveCredential: jest.fn(),
    } as unknown as jest.Mocked<UserWriteRepositoryPort>;
    const assignmentRepository = {
      assignToUser: jest.fn(),
      removeFromUser: jest.fn(),
      assignToGroup: jest.fn(),
      removeFromGroup: jest.fn(),
      existsForUser: jest.fn(async () => assignmentExists),
      existsForGroup: jest.fn(),
      listForUser: jest.fn(),
      listForGroup: jest.fn(),
    } as unknown as jest.Mocked<RoleAssignmentRepository>;
    const clientRepository = {
      findById: jest.fn(),
      findByClientId: jest.fn(async () => client),
      list: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<ClientRepository>;
    const tenantCommand = {
      createTenant: jest.fn(async () => {
        tenant = makeTenant();
        return { id: tenant.id };
      }),
      updateTenant: jest.fn(),
      deleteTenant: jest.fn(),
    } as unknown as jest.Mocked<TenantCommandPort>;
    const roleCommand = {
      createRole: jest.fn(async () => {
        role = makeRole();
        return { id: role.id };
      }),
      updateRole: jest.fn(),
      deleteRole: jest.fn(),
      addPermissionToRole: jest.fn(),
      removePermissionFromRole: jest.fn(),
    } as unknown as jest.Mocked<RoleCommandPort>;
    const userCommand = {
      createUser: jest.fn(async () => {
        user = makeUser();
        return { id: user.id };
      }),
      updateUser: jest.fn(),
      deleteUser: jest.fn(),
      assignRole: jest.fn(async () => {
        assignmentExists = true;
      }),
      removeRole: jest.fn(),
      revokeUserSession: jest.fn(),
      revokeUserSessions: jest.fn(),
    } as unknown as jest.Mocked<UserCommandPort>;
    const clientCommand = {
      createClient: jest.fn(async () => {
        client = makePortal();
        return { id: client.id };
      }),
      updateClient: jest.fn(),
      updateClientAuthPolicy: jest.fn(),
      deleteClient: jest.fn(),
    } as unknown as jest.Mocked<ClientCommandPort>;
    const manager = new AdminBootstrapProcessManager(
      runner,
      tenantCommand,
      userCommand,
      roleCommand,
      clientCommand,
      tenantRepository,
      userRepository,
      roleRepository,
      assignmentRepository,
      clientRepository,
    );

    return {
      manager,
      state,
      runner,
      tenantRepository,
      userRepository,
      roleRepository,
      assignmentRepository,
      clientRepository,
      tenantCommand,
      userCommand,
      roleCommand,
      clientCommand,
    };
  }

  it('runs missing resources through command ports in order and explicitly completes', async () => {
    const subject = createSubject({
      tenant: null,
      role: null,
      user: undefined,
      assignmentExists: false,
      client: null,
    });
    const run = jest.spyOn(subject.runner, 'run');
    const complete = jest.spyOn(subject.runner, 'complete');

    await subject.manager.bootstrap(input);

    expect(run.mock.calls.map(([params]) => params.expectedStep)).toEqual([
      'tenant',
      'role',
      'user',
      'role-assignment',
      'client',
    ]);
    expect(run.mock.calls.map(([params]) => params.nextStep)).toEqual([
      'role',
      'user',
      'role-assignment',
      'client',
      'completed',
    ]);
    for (const [params] of run.mock.calls) {
      expect(params.processKey).toBe(processKey);
      expect(params.steps).toEqual(steps);
    }
    expect(complete).toHaveBeenCalledWith({
      processKey,
      initialStep: 'tenant',
      expectedStep: 'completed',
      steps,
    });
    expect(run.mock.invocationCallOrder[4]).toBeLessThan(
      complete.mock.invocationCallOrder[0],
    );
    expect(subject.tenantCommand.createTenant).toHaveBeenCalledWith(
      CreateTenantDto.of({ code: 'master', name: 'Master' }),
      auditContext,
    );
    expect(subject.roleCommand.createRole).toHaveBeenCalledWith(
      'tenant-master',
      CreateRoleDto.of({
        code: 'SUPER_ADMIN',
        name: 'Super Admin',
        description: '플랫폼 최고 관리자',
      }),
      auditContext,
    );
    expect(subject.userCommand.createUser).toHaveBeenCalledWith(
      'tenant-master',
      CreateUserDto.of({
        username: 'admin',
        password: 'Admin1234!',
        temporaryPassword: true,
        email: 'admin@localhost',
      }),
      auditContext,
    );
    expect(subject.userCommand.assignRole).toHaveBeenCalledWith(
      'tenant-master',
      'user-admin',
      'role-super-admin',
      auditContext,
    );
    expect(subject.clientCommand.createClient).toHaveBeenCalledWith(
      'tenant-master',
      CreateClientDto.of({
        clientId: '__admin-portal__',
        name: 'Admin Portal',
        type: 'confidential',
        redirectUris: ['http://localhost:5173/admin/tenants'],
        grantTypes: ['authorization_code'],
        responseTypes: ['code'],
        tokenEndpointAuthMethod: 'none',
        scope: 'openid profile',
        postLogoutRedirectUris: ['http://localhost:5173/login'],
        applicationType: 'web',
        skipConsent: true,
      }),
      auditContext,
    );
    expect(subject.state.status).toBe('completed');
    expect(subject.tenantRepository.findByCode).toHaveBeenCalledTimes(5);
    expect(subject.roleRepository.findByCode).toHaveBeenCalledTimes(2);
    expect(subject.userRepository.findByUsername).toHaveBeenCalledTimes(2);
    expect(subject.tenantRepository.save).not.toHaveBeenCalled();
    expect(subject.roleRepository.save).not.toHaveBeenCalled();
    expect(subject.userRepository.save).not.toHaveBeenCalled();
    expect(subject.assignmentRepository.assignToUser).not.toHaveBeenCalled();
    expect(subject.clientRepository.save).not.toHaveBeenCalled();
  });

  it('fails the user step with a safe credentials code when a missing user has no password', async () => {
    const state = BootstrapProcessState.rehydrate({
      processKey,
      step: 'user',
      status: 'pending',
      retryCount: 0,
      lastFailureCode: null,
    });
    const subject = createSubject({ state, user: undefined });

    await expect(
      subject.manager.bootstrap({ ...input, password: undefined }),
    ).rejects.toMatchObject({
      name: 'BootstrapProcessError',
      message: 'ADMIN_CREDENTIALS_REQUIRED',
      code: 'ADMIN_CREDENTIALS_REQUIRED',
    });

    expect(subject.userCommand.createUser).not.toHaveBeenCalled();
    expect(state.step).toBe('user');
    expect(state.status).toBe('failed');
    expect(state.lastFailureCode).toBe('ADMIN_CREDENTIALS_REQUIRED');
  });

  it('does not require or reset a password for an existing administrator', async () => {
    const state = BootstrapProcessState.rehydrate({
      processKey,
      step: 'user',
      status: 'pending',
      retryCount: 0,
      lastFailureCode: null,
    });
    const subject = createSubject({
      state,
      user: makeUser('existing-admin'),
      assignmentExists: true,
      client: makePortal(),
    });

    await subject.manager.bootstrap({
      username: 'existing-admin',
      password: undefined,
      adminUiUrl: input.adminUiUrl,
    });

    expect(subject.userCommand.createUser).not.toHaveBeenCalled();
    expect(subject.userCommand.updateUser).not.toHaveBeenCalled();
    expect(subject.userCommand.deleteUser).not.toHaveBeenCalled();
    expect(subject.userRepository.save).not.toHaveBeenCalled();
    expect(subject.userRepository.createCredential).not.toHaveBeenCalled();
    expect(subject.userRepository.saveCredential).not.toHaveBeenCalled();
    expect(state.status).toBe('completed');
  });

  it('creates only a missing role assignment through the user command port', async () => {
    const state = BootstrapProcessState.rehydrate({
      processKey,
      step: 'role-assignment',
      status: 'pending',
      retryCount: 0,
      lastFailureCode: null,
    });
    const subject = createSubject({
      state,
      user: makeUser(),
      assignmentExists: false,
    });

    await subject.manager.bootstrap(input);

    expect(subject.assignmentRepository.existsForUser).toHaveBeenCalledWith({
      userId: 'user-admin',
      roleId: 'role-super-admin',
    });
    expect(subject.userCommand.assignRole).toHaveBeenCalledWith(
      'tenant-master',
      'user-admin',
      'role-super-admin',
      auditContext,
    );
    expect(subject.assignmentRepository.assignToUser).not.toHaveBeenCalled();
    expect(subject.assignmentRepository.removeFromUser).not.toHaveBeenCalled();
  });

  it('does not write an existing role assignment', async () => {
    const state = BootstrapProcessState.rehydrate({
      processKey,
      step: 'role-assignment',
      status: 'pending',
      retryCount: 0,
      lastFailureCode: null,
    });
    const subject = createSubject({
      state,
      user: makeUser(),
      assignmentExists: true,
    });

    await subject.manager.bootstrap(input);

    expect(subject.userCommand.assignRole).not.toHaveBeenCalled();
    expect(subject.userCommand.removeRole).not.toHaveBeenCalled();
    expect(subject.assignmentRepository.assignToUser).not.toHaveBeenCalled();
    expect(subject.assignmentRepository.removeFromUser).not.toHaveBeenCalled();
  });

  it('creates the missing portal with the exact approved metadata', async () => {
    const state = BootstrapProcessState.rehydrate({
      processKey,
      step: 'client',
      status: 'pending',
      retryCount: 0,
      lastFailureCode: null,
    });
    const subject = createSubject({ state, client: null });

    await subject.manager.bootstrap(input);

    expect(subject.clientCommand.createClient).toHaveBeenCalledWith(
      'tenant-master',
      CreateClientDto.of({
        clientId: '__admin-portal__',
        name: 'Admin Portal',
        type: 'confidential',
        redirectUris: ['http://localhost:5173/admin/tenants'],
        grantTypes: ['authorization_code'],
        responseTypes: ['code'],
        tokenEndpointAuthMethod: 'none',
        scope: 'openid profile',
        postLogoutRedirectUris: ['http://localhost:5173/login'],
        applicationType: 'web',
        skipConsent: true,
      }),
      auditContext,
    );
    expect(subject.clientCommand.updateClient).not.toHaveBeenCalled();
    expect(subject.clientRepository.save).not.toHaveBeenCalled();
  });

  it('keeps an exactly matching portal unchanged', async () => {
    const state = BootstrapProcessState.rehydrate({
      processKey,
      step: 'client',
      status: 'pending',
      retryCount: 0,
      lastFailureCode: null,
    });
    const subject = createSubject({ state, client: makePortal() });

    await subject.manager.bootstrap(input);

    expect(subject.clientCommand.createClient).not.toHaveBeenCalled();
    expect(subject.clientCommand.updateClient).not.toHaveBeenCalled();
    expect(subject.clientCommand.deleteClient).not.toHaveBeenCalled();
    expect(subject.clientRepository.save).not.toHaveBeenCalled();
    expect(state.status).toBe('completed');
  });

  it.each([
    ['tenantId', { tenantId: 'tenant-other' }],
    ['clientId', { clientId: '__other-client__' }],
    ['name', { name: 'Drifted Portal' }],
    ['type', { type: 'public' as const }],
    ['enabled', { enabled: false }],
    ['redirectUris', { redirectUris: ['https://wrong.example/callback'] }],
    ['grantTypes', { grantTypes: ['client_credentials'] }],
    ['responseTypes', { responseTypes: ['token'] }],
    [
      'tokenEndpointAuthMethod',
      { tokenEndpointAuthMethod: 'client_secret_basic' },
    ],
    ['scope', { scope: 'openid' }],
    [
      'postLogoutRedirectUris',
      { postLogoutRedirectUris: ['https://wrong.example/logout'] },
    ],
    ['applicationType', { applicationType: 'native' as const }],
    ['secretEnc', { secretEnc: 'encrypted-secret' }],
    [
      'backchannelLogoutUri',
      { backchannelLogoutUri: 'https://wrong.example/backchannel' },
    ],
    [
      'frontchannelLogoutUri',
      { frontchannelLogoutUri: 'https://wrong.example/frontchannel' },
    ],
    [
      'allowedResources',
      { allowedResources: ['https://wrong.example/resource'] },
    ],
    ['skipConsent', { skipConsent: false }],
    ['accessTokenTtlSec', { accessTokenTtlSec: 60 }],
    ['refreshTokenTtlSec', { refreshTokenTtlSec: 60 }],
  ] satisfies ReadonlyArray<
    readonly [string, Partial<ConstructorParameters<typeof ClientModel>[0]>]
  >)(
    'fails safely when existing portal %s is incompatible',
    async (_field, overrides) => {
      const state = BootstrapProcessState.rehydrate({
        processKey,
        step: 'client',
        status: 'pending',
        retryCount: 0,
        lastFailureCode: null,
      });
      const subject = createSubject({ state, client: makePortal(overrides) });

      await expect(subject.manager.bootstrap(input)).rejects.toMatchObject({
        name: 'BootstrapProcessError',
        message: 'ADMIN_PORTAL_CONFLICT',
        code: 'ADMIN_PORTAL_CONFLICT',
      });

      expect(subject.clientCommand.createClient).not.toHaveBeenCalled();
      expect(subject.clientCommand.updateClient).not.toHaveBeenCalled();
      expect(subject.clientCommand.deleteClient).not.toHaveBeenCalled();
      expect(subject.clientRepository.save).not.toHaveBeenCalled();
      expect(state.status).toBe('failed');
      expect(state.lastFailureCode).toBe('ADMIN_PORTAL_CONFLICT');
    },
  );

  it('does no resource reads or writes on a completed rerun and retains no password', async () => {
    const state = BootstrapProcessState.rehydrate({
      processKey,
      step: 'completed',
      status: 'completed',
      retryCount: 0,
      lastFailureCode: null,
    });
    const subject = createSubject({ state });
    const secretInput = { ...input, password: 'never-retain-this-password' };

    await subject.manager.bootstrap(secretInput);

    expect(subject.tenantRepository.findByCode).not.toHaveBeenCalled();
    expect(subject.roleRepository.findByCode).not.toHaveBeenCalled();
    expect(subject.userRepository.findByUsername).not.toHaveBeenCalled();
    expect(subject.assignmentRepository.existsForUser).not.toHaveBeenCalled();
    expect(subject.clientRepository.findByClientId).not.toHaveBeenCalled();
    for (const command of [
      subject.tenantCommand,
      subject.roleCommand,
      subject.userCommand,
      subject.clientCommand,
    ]) {
      for (const method of Object.values(command)) {
        expect(method).not.toHaveBeenCalled();
      }
    }
    expect(JSON.stringify(subject.manager)).not.toContain(secretInput.password);
    expect(JSON.stringify(state)).not.toContain(secretInput.password);
    expect(state.status).toBe('completed');
  });

  it('sanitizes an unexpected step failure and does not complete', async () => {
    const subject = createSubject();
    subject.tenantRepository.findByCode.mockRejectedValue(
      new Error('password=secret database.internal'),
    );
    const complete = jest.spyOn(subject.runner, 'complete');

    const caught = await subject.manager
      .bootstrap(input)
      .catch((error: unknown) => error);

    expect(caught).toMatchObject({
      name: 'BootstrapProcessError',
      message: 'BOOTSTRAP_STEP_FAILED',
      code: 'BOOTSTRAP_STEP_FAILED',
    });
    expect((caught as Error).stack).not.toContain('password=secret');
    expect(caught).not.toHaveProperty('cause');
    expect(subject.state.status).toBe('failed');
    expect(subject.state.lastFailureCode).toBe('BOOTSTRAP_STEP_FAILED');
    expect(JSON.stringify(subject.state)).not.toContain('database.internal');
    expect(complete).not.toHaveBeenCalled();
  });
});
