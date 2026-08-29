import { TenantCommandPort } from '@application/commands/ports/tenant-command.port';
import { CreateTenantDto } from '@application/dto';
import { AcmeBootstrapProcessManager } from '@application/process-managers/acme-bootstrap.process-manager';
import { BootstrapProcessState } from '@application/process-managers/bootstrap-process-state';
import { BootstrapStepRunner } from '@application/process-managers/bootstrap-step-runner';
import type { BootstrapProcessRepository } from '@application/process-managers/ports/bootstrap-process.repository';
import { TenantModel } from '@domain/models/tenant';
import type { TenantRepository } from '@domain/repositories';

describe('AcmeBootstrapProcessManager', () => {
  function existingTenant(): TenantModel {
    const tenant = new TenantModel({
      code: 'acme',
      name: 'Existing tenant name',
    });
    tenant.setPersistence('tenant-acme', new Date(), new Date());
    return tenant;
  }

  function createSubject(params?: {
    state?: BootstrapProcessState;
    tenant?: TenantModel | null;
  }): {
    manager: AcmeBootstrapProcessManager;
    state: BootstrapProcessState;
    runner: BootstrapStepRunner;
    tenantRepository: jest.Mocked<TenantRepository>;
    tenantCommand: jest.Mocked<TenantCommandPort>;
  } {
    const state =
      params?.state ??
      BootstrapProcessState.start('bootstrap:acme:v1', 'tenant');
    const processRepository = {
      withLockedState: jest.fn(async (_params, work) => work(state)),
    } as jest.Mocked<BootstrapProcessRepository>;
    const runner = new BootstrapStepRunner(processRepository);
    const tenantRepository = {
      findByCode: jest.fn().mockResolvedValue(params?.tenant ?? null),
      findById: jest.fn(),
      list: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    } as jest.Mocked<TenantRepository>;
    const tenantCommand = {
      createTenant: jest.fn().mockResolvedValue({ id: 'tenant-acme' }),
      ensureBuiltInScopes: jest.fn().mockResolvedValue(undefined),
      updateTenant: jest.fn().mockResolvedValue(undefined),
      deleteTenant: jest.fn().mockResolvedValue(undefined),
    } as jest.Mocked<TenantCommandPort>;

    return {
      manager: new AcmeBootstrapProcessManager(
        runner,
        tenantCommand,
        tenantRepository,
      ),
      state,
      runner,
      tenantRepository,
      tenantCommand,
    };
  }

  it('creates the missing acme tenant through the command port before explicit completion', async () => {
    const { manager, state, runner, tenantRepository, tenantCommand } =
      createSubject();
    const run = jest.spyOn(runner, 'run');
    const complete = jest.spyOn(runner, 'complete');

    await manager.bootstrap();

    expect(tenantRepository.findByCode).toHaveBeenCalledTimes(1);
    expect(tenantRepository.findByCode).toHaveBeenCalledWith('acme');
    expect(tenantCommand.createTenant).toHaveBeenCalledTimes(1);
    expect(tenantCommand.createTenant).toHaveBeenCalledWith(
      CreateTenantDto.of({ code: 'acme', name: 'Acme' }),
    );
    expect(tenantCommand.updateTenant).not.toHaveBeenCalled();
    expect(tenantCommand.deleteTenant).not.toHaveBeenCalled();
    expect(tenantRepository.save).not.toHaveBeenCalled();
    expect(tenantRepository.delete).not.toHaveBeenCalled();
    expect(run).toHaveBeenCalledWith({
      processKey: 'bootstrap:acme:v1',
      initialStep: 'tenant',
      expectedStep: 'tenant',
      nextStep: 'completed',
      steps: ['tenant', 'completed'],
      work: expect.any(Function),
    });
    expect(complete).toHaveBeenCalledWith({
      processKey: 'bootstrap:acme:v1',
      initialStep: 'tenant',
      expectedStep: 'completed',
      steps: ['tenant', 'completed'],
    });
    expect(run.mock.invocationCallOrder[0]).toBeLessThan(
      complete.mock.invocationCallOrder[0],
    );
    expect(state.status).toBe('completed');
  });

  it('keeps an existing acme tenant unchanged even when its name differs', async () => {
    const tenant = existingTenant();
    const { manager, state, tenantRepository, tenantCommand } = createSubject({
      tenant,
    });

    await manager.bootstrap();

    expect(tenantRepository.findByCode).toHaveBeenCalledTimes(1);
    expect(tenantRepository.findByCode).toHaveBeenCalledWith('acme');
    expect(tenant.name).toBe('Existing tenant name');
    expect(tenantCommand.createTenant).not.toHaveBeenCalled();
    expect(tenantCommand.updateTenant).not.toHaveBeenCalled();
    expect(tenantCommand.deleteTenant).not.toHaveBeenCalled();
    expect(tenantRepository.save).not.toHaveBeenCalled();
    expect(tenantRepository.delete).not.toHaveBeenCalled();
    expect(state.status).toBe('completed');
  });

  it('does no tenant work when the bootstrap process is already completed', async () => {
    const completedState = BootstrapProcessState.rehydrate({
      processKey: 'bootstrap:acme:v1',
      step: 'completed',
      status: 'completed',
      retryCount: 0,
      lastFailureCode: null,
    });
    const { manager, state, tenantRepository, tenantCommand } = createSubject({
      state: completedState,
    });

    await manager.bootstrap();

    expect(tenantRepository.findByCode).not.toHaveBeenCalled();
    expect(tenantCommand.createTenant).not.toHaveBeenCalled();
    expect(tenantCommand.updateTenant).not.toHaveBeenCalled();
    expect(tenantCommand.deleteTenant).not.toHaveBeenCalled();
    expect(tenantRepository.save).not.toHaveBeenCalled();
    expect(tenantRepository.delete).not.toHaveBeenCalled();
    expect(state).toBe(completedState);
    expect(state.status).toBe('completed');
  });

  it('does not falsely complete when tenant creation fails', async () => {
    const { manager, state, runner, tenantCommand } = createSubject();
    tenantCommand.createTenant.mockRejectedValue(
      new Error('database.internal password=secret'),
    );
    const complete = jest.spyOn(runner, 'complete');

    await expect(manager.bootstrap()).rejects.toMatchObject({
      name: 'BootstrapProcessError',
      code: 'BOOTSTRAP_STEP_FAILED',
    });

    expect(complete).not.toHaveBeenCalled();
    expect(state.step).toBe('tenant');
    expect(state.status).toBe('failed');
    expect(state.retryCount).toBe(1);
    expect(state.lastFailureCode).toBe('BOOTSTRAP_STEP_FAILED');
    expect(JSON.stringify(state)).not.toContain('secret');
    expect(JSON.stringify(state)).not.toContain('database.internal');
  });
});
