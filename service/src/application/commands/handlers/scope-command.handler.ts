import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ScopeCommandPort } from '../ports/scope-command.port';
import { AuditContext, CreateScopeDto, UpdateScopeDto } from '@application/dto';
import { ScopeRepository } from '@domain/repositories';
import { ScopeModel, isValidScopeToken } from '@domain/models/scope';
import { orThrow } from '@domain/utils';
import { AuditRecorder } from '@application/services/audit-recorder';

@Injectable()
export class ScopeCommandHandler implements ScopeCommandPort {
  private readonly logger = new Logger(ScopeCommandHandler.name);

  constructor(
    private readonly scopeRepo: ScopeRepository,
    private readonly auditRecorder?: AuditRecorder,
  ) {}

  async createScope(
    tenantId: string,
    dto: CreateScopeDto,
    auditContext?: AuditContext,
  ): Promise<{ id: string }> {
    this.logger.log(`Creating scope name=${dto.name} in tenant=${tenantId}`);
    this.assertScopeName(dto.name);

    const existing = await this.scopeRepo.findByName(tenantId, dto.name);
    if (existing) throw new ConflictException('Scope already exists');

    const scope = new ScopeModel({
      tenantId,
      name: dto.name,
      displayName: dto.displayName ?? dto.name,
      description: dto.description ?? null,
      claimKeys: normalizeClaimKeys(dto.claimKeys ?? []),
      enabled: dto.enabled ?? true,
      builtIn: false,
    });

    const saved = await this.scopeRepo.save(scope);
    await this.auditRecorder?.recordAdminAction({
      tenantId,
      category: 'SYSTEM',
      action: 'CREATE',
      resourceType: 'scope',
      resourceId: saved.id,
      metadata: {
        name: saved.name,
        claimKeys: saved.claimKeys,
        enabled: saved.enabled,
      },
      auditContext,
    });

    return { id: saved.id };
  }

  async updateScope(
    tenantId: string,
    id: string,
    dto: UpdateScopeDto,
    auditContext?: AuditContext,
  ): Promise<void> {
    this.logger.log(`Updating scope id=${id} in tenant=${tenantId}`);

    const scope = orThrow(
      await this.scopeRepo.findById(id),
      new NotFoundException('Scope not found'),
      (s) => s.tenantId === tenantId,
    );

    if (dto.displayName !== undefined) scope.changeDisplayName(dto.displayName);
    if (dto.description !== undefined)
      scope.changeDescription(dto.description ?? null);
    if (dto.claimKeys !== undefined)
      scope.changeClaimKeys(normalizeClaimKeys(dto.claimKeys));
    if (dto.enabled !== undefined) scope.setEnabled(dto.enabled);

    await this.scopeRepo.save(scope);
    await this.auditRecorder?.recordAdminAction({
      tenantId,
      category: 'SYSTEM',
      action: 'UPDATE',
      resourceType: 'scope',
      resourceId: id,
      metadata: { changedFields: Object.keys(dto) },
      auditContext,
    });
  }

  async deleteScope(
    tenantId: string,
    id: string,
    auditContext?: AuditContext,
  ): Promise<void> {
    this.logger.log(`Deleting scope id=${id} in tenant=${tenantId}`);

    const scope = orThrow(
      await this.scopeRepo.findById(id),
      new NotFoundException('Scope not found'),
      (s) => s.tenantId === tenantId,
    );
    if (scope.builtIn) {
      throw new BadRequestException('Built-in scope cannot be deleted');
    }

    await this.auditRecorder?.recordAdminAction({
      tenantId,
      category: 'SYSTEM',
      action: 'DELETE',
      resourceType: 'scope',
      resourceId: id,
      metadata: { name: scope.name },
      auditContext,
    });
    await this.scopeRepo.delete(id);
  }

  private assertScopeName(scope: string): void {
    if (!isValidScopeToken(scope)) {
      throw new BadRequestException('Invalid scope name');
    }
  }
}

function normalizeClaimKeys(claimKeys: string[]): string[] {
  return [...new Set(claimKeys.map((key) => key.trim()).filter(Boolean))];
}
