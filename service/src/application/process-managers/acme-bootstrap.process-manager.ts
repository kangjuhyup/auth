import type { TenantCommandPort } from '@application/commands/ports/tenant-command.port';
import { CreateTenantDto } from '@application/dto';
import type { TenantRepository } from '@domain/repositories';
import { BootstrapStepRunner } from './bootstrap-step-runner';
import { AcmeBootstrapPort } from './ports/acme-bootstrap.port';

const PROCESS_KEY = 'bootstrap:acme:v1';
const STEPS = ['tenant', 'completed'] as const;

export class AcmeBootstrapProcessManager implements AcmeBootstrapPort {
  constructor(
    private readonly runner: BootstrapStepRunner,
    private readonly tenantCommand: TenantCommandPort,
    private readonly tenantRepository: TenantRepository,
  ) {}

  async bootstrap(): Promise<void> {
    await this.runner.run({
      processKey: PROCESS_KEY,
      initialStep: 'tenant',
      expectedStep: 'tenant',
      nextStep: 'completed',
      steps: STEPS,
      work: async () => {
        const existingTenant = await this.tenantRepository.findByCode('acme');
        if (existingTenant) {
          return;
        }

        await this.tenantCommand.createTenant(
          CreateTenantDto.of({ code: 'acme', name: 'Acme' }),
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
}
