import { MODULE_METADATA } from '@nestjs/common/constants';
import { TenantCommandPort } from '@application/commands/ports/tenant-command.port';
import { ClientCommandPort } from '@application/commands/ports/client-command.port';
import { RoleCommandPort } from '@application/commands/ports/role-command.port';
import { UserCommandPort } from '@application/commands/ports/user-command.port';
import { UserWriteRepositoryPort } from '@application/commands/ports/user-write-repository.port';
import { ApplicationModule } from '@application/application.module';
import { AcmeBootstrapProcessManager } from '@application/process-managers/acme-bootstrap.process-manager';
import { AdminBootstrapProcessManager } from '@application/process-managers/admin-bootstrap.process-manager';
import { BootstrapStepRunner } from '@application/process-managers/bootstrap-step-runner';
import { AcmeBootstrapPort } from '@application/process-managers/ports/acme-bootstrap.port';
import { AdminBootstrapPort } from '@application/process-managers/ports/admin-bootstrap.port';
import { BootstrapProcessRepository } from '@application/process-managers/ports/bootstrap-process.repository';
import {
  ClientRepository,
  RoleAssignmentRepository,
  RoleRepository,
  ScopeRepository,
  TenantRepository,
} from '@domain/repositories';
import { InfrastructureModule } from '@infrastructure/infrastructure.module';
import { BootstrapProcessRepositoryImpl } from '@infrastructure/repositories/bootstrap-process.repository.impl';

type ProviderDefinition = {
  provide?: unknown;
  useClass?: unknown;
  useFactory?: (...dependencies: never[]) => unknown;
  inject?: unknown[];
};

function metadata<T>(module: object, key: string): T[] {
  return Reflect.getMetadata(key, module) ?? [];
}

function providerFor(module: object, token: unknown): ProviderDefinition {
  const provider = metadata<ProviderDefinition>(
    module,
    MODULE_METADATA.PROVIDERS,
  ).find((candidate) => candidate.provide === token);
  if (!provider) {
    throw new Error('Expected provider was not registered');
  }
  return provider;
}

describe('bootstrap module wiring', () => {
  it('binds the process-state repository to its MikroORM adapter', () => {
    expect(
      providerFor(InfrastructureModule, BootstrapProcessRepository),
    ).toEqual(
      expect.objectContaining({
        provide: BootstrapProcessRepository,
        useClass: BootstrapProcessRepositoryImpl,
      }),
    );
    expect(metadata(InfrastructureModule, MODULE_METADATA.EXPORTS)).toContain(
      BootstrapProcessRepository,
    );
  });

  it('binds the step runner to the persisted process repository', () => {
    const provider = providerFor(ApplicationModule, BootstrapStepRunner);

    expect(provider.inject).toEqual([BootstrapProcessRepository]);
    expect(provider.useFactory).toBeInstanceOf(Function);
    expect(metadata(ApplicationModule, MODULE_METADATA.EXPORTS)).toContain(
      BootstrapStepRunner,
    );
  });

  it('binds the administrator port to existing command and write-repository providers', () => {
    const provider = providerFor(ApplicationModule, AdminBootstrapPort);

    expect(provider.inject).toEqual([
      BootstrapStepRunner,
      TenantCommandPort,
      UserCommandPort,
      RoleCommandPort,
      ClientCommandPort,
      TenantRepository,
      ScopeRepository,
      UserWriteRepositoryPort,
      RoleRepository,
      RoleAssignmentRepository,
      ClientRepository,
    ]);
    expect(provider.useFactory).toBeInstanceOf(Function);
    expect(metadata(ApplicationModule, MODULE_METADATA.EXPORTS)).toContain(
      AdminBootstrapPort,
    );

    const dependencies = provider.inject!.map(() => ({}));
    expect(provider.useFactory!(...(dependencies as never[]))).toBeInstanceOf(
      AdminBootstrapProcessManager,
    );
  });

  it('binds the acme port to the tenant command path only', () => {
    const provider = providerFor(ApplicationModule, AcmeBootstrapPort);

    expect(provider.inject).toEqual([
      BootstrapStepRunner,
      TenantCommandPort,
      TenantRepository,
    ]);
    expect(provider.useFactory).toBeInstanceOf(Function);
    expect(metadata(ApplicationModule, MODULE_METADATA.EXPORTS)).toContain(
      AcmeBootstrapPort,
    );

    const dependencies = provider.inject!.map(() => ({}));
    expect(provider.useFactory!(...(dependencies as never[]))).toBeInstanceOf(
      AcmeBootstrapProcessManager,
    );
  });
});
