import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Transactional } from '@application/decorators/transactional.decorator';
import { TransactionManagerPort } from '@application/ports/transaction-manager.port';
import { PolicyCommandPort } from '../ports/policy-command.port';
import { TenantRepository, TenantConfigRepository } from '@domain/repositories';
import { TenantConfigModel } from '@domain/models/tenant-config';
import { orThrow } from '@domain/utils';

@Injectable()
export class PolicyCommandHandler implements PolicyCommandPort {
  private readonly logger = new Logger(PolicyCommandHandler.name);

  constructor(
    private readonly tenantRepo: TenantRepository,
    private readonly tenantConfigRepo: TenantConfigRepository,
    protected readonly transactionManager: TransactionManagerPort,
  ) {}

  @Transactional()
  async updatePolicies(
    tenantId: string,
    policies: Record<string, unknown>,
  ): Promise<void> {
    if (!policies || typeof policies !== 'object' || Array.isArray(policies)) {
      throw new BadRequestException('Invalid policies payload');
    }

    orThrow(
      await this.tenantRepo.findById(tenantId),
      new NotFoundException('Tenant not found'),
    );

    let config = await this.tenantConfigRepo.findByTenantId(tenantId);

    if (!config) {
      config = new TenantConfigModel({
        tenantId,
        signupPolicy: 'open',
        requirePhoneVerify: false,
        brandName: null,
        extra: null,
      });
    }

    config.updatePolicies(policies);
    await this.tenantConfigRepo.save(config);

    this.logger.log(`Updated policies for tenant=${tenantId}`);
  }
}
