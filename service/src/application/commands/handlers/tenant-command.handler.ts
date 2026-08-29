import {
  Injectable,
  ConflictException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { TenantCommandPort } from '../ports/tenant-command.port';
import {
  AuditContext,
  CreateTenantDto,
  UpdateTenantDto,
} from '@application/dto';
import { ScopeRepository, TenantRepository } from '@domain/repositories';
import { TenantModel } from '@domain/models/tenant';
import {
  BUILT_IN_OIDC_SCOPES,
  type BuiltInOidcScope,
  ScopeModel,
} from '@domain/models/scope';
import { orThrow } from '@domain/utils';
import { AuditRecorder } from '@application/services/audit-recorder';

@Injectable()
export class TenantCommandHandler implements TenantCommandPort {
  private readonly logger = new Logger(TenantCommandHandler.name);

  constructor(
    private readonly tenantRepo: TenantRepository,
    private readonly scopeRepo: ScopeRepository,
    private readonly auditRecorder?: AuditRecorder,
  ) {}

  async createTenant(
    dto: CreateTenantDto,
    auditContext?: AuditContext,
  ): Promise<{ id: string }> {
    this.logger.log(`Creating tenant with code=${dto.code}`);

    const existing = await this.tenantRepo.findByCode(dto.code);
    if (existing) throw new ConflictException('Tenant code already exists');

    const tenant = new TenantModel({ code: dto.code, name: dto.name });
    const saved = await this.tenantRepo.save(tenant);
    await this.seedBuiltInScopes(saved.id, BUILT_IN_OIDC_SCOPES, auditContext);
    await this.auditRecorder?.recordAdminAction({
      tenantId: saved.id,
      action: 'CREATE',
      resourceType: 'tenant',
      resourceId: saved.id,
      metadata: { code: saved.code },
      auditContext,
    });

    return { id: saved.id };
  }

  async ensureBuiltInScopes(
    tenantId: string,
    scopeNames: readonly BuiltInOidcScope[],
    auditContext?: AuditContext,
  ): Promise<void> {
    await this.seedBuiltInScopes(tenantId, scopeNames, auditContext);
  }

  private async seedBuiltInScopes(
    tenantId: string,
    scopeNames: readonly BuiltInOidcScope[],
    auditContext?: AuditContext,
  ): Promise<void> {
    for (const scope of scopeNames) {
      const existing = await this.scopeRepo.findByName(tenantId, scope);
      if (existing) {
        if (
          existing.tenantId !== tenantId ||
          existing.name !== scope ||
          !existing.builtIn
        ) {
          throw new ConflictException('Built-in scope identity conflict');
        }
        continue;
      }
      const saved = await this.scopeRepo.save(
        new ScopeModel({
          tenantId,
          name: scope,
          displayName: defaultScopeDisplayName(scope),
          description: defaultScopeDescription(scope),
          claimKeys: defaultScopeClaimKeys(scope),
          enabled: true,
          builtIn: true,
        }),
      );
      await this.auditRecorder?.recordAdminAction({
        tenantId,
        category: 'SYSTEM',
        action: 'CREATE',
        resourceType: 'scope',
        resourceId: saved.id,
        metadata: { name: saved.name, builtIn: true },
        auditContext,
      });
    }
  }

  async updateTenant(
    id: string,
    dto: UpdateTenantDto,
    auditContext?: AuditContext,
  ): Promise<void> {
    this.logger.log(`Updating tenant id=${id}`);

    const tenant = orThrow(
      await this.tenantRepo.findById(id),
      new NotFoundException('Tenant not found'),
    );

    if (dto.name) tenant.changeName(dto.name);

    await this.tenantRepo.save(tenant);
    await this.auditRecorder?.recordAdminAction({
      tenantId: tenant.id,
      action: 'UPDATE',
      resourceType: 'tenant',
      resourceId: tenant.id,
      metadata: { changedFields: Object.keys(dto) },
      auditContext,
    });
  }

  async deleteTenant(id: string, auditContext?: AuditContext): Promise<void> {
    this.logger.log(`Deleting tenant id=${id}`);

    orThrow(
      await this.tenantRepo.findById(id),
      new NotFoundException('Tenant not found'),
    );

    await this.auditRecorder?.recordAdminAction({
      tenantId: id,
      action: 'DELETE',
      resourceType: 'tenant',
      resourceId: id,
      auditContext,
    });
    await this.tenantRepo.delete(id);
  }
}

function defaultScopeDisplayName(scope: string): string {
  if (scope === 'openid') return 'OpenID';
  if (scope === 'profile') return 'Profile';
  if (scope === 'email') return 'Email';
  return scope;
}

function defaultScopeDescription(scope: string): string {
  if (scope === 'openid') return 'OIDC authentication scope';
  if (scope === 'profile') return 'Basic profile claims';
  if (scope === 'email') return 'Email claims';
  return scope;
}

function defaultScopeClaimKeys(scope: string): string[] {
  if (scope === 'profile') return ['profile'];
  if (scope === 'email') return ['email'];
  return [];
}
