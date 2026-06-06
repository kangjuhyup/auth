import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditContext,
  CreateCustomGrantDto,
  UpdateCustomGrantDto,
} from '@application/dto';
import { CustomGrantCommandPort } from '../ports/custom-grant-command.port';
import { CustomGrantRepository } from '@domain/repositories';
import {
  CustomGrantModel,
  isValidCustomGrantType,
} from '@domain/models/custom-grant';
import type { ApplicationType, ClientType } from '@domain/models/client';
import { orThrow } from '@domain/utils';
import { AuditRecorder } from '@application/services/audit-recorder';

const DEFAULT_CLIENT_TYPES: ClientType[] = ['confidential'];
const DEFAULT_APPLICATION_TYPES: ApplicationType[] = ['web'];

@Injectable()
export class CustomGrantCommandHandler implements CustomGrantCommandPort {
  private readonly logger = new Logger(CustomGrantCommandHandler.name);

  constructor(
    private readonly customGrantRepo: CustomGrantRepository,
    private readonly auditRecorder?: AuditRecorder,
  ) {}

  async createCustomGrant(
    tenantId: string,
    dto: CreateCustomGrantDto,
    auditContext?: AuditContext,
  ): Promise<{ id: string }> {
    this.logger.log(
      `Creating custom grant grantType=${dto.grantType} in tenant=${tenantId}`,
    );
    this.assertGrantType(dto.grantType);

    const existing = await this.customGrantRepo.findByGrantType(
      tenantId,
      dto.grantType,
    );
    if (existing) throw new ConflictException('Custom grant already exists');

    const grant = new CustomGrantModel({
      tenantId,
      grantType: dto.grantType,
      displayName: dto.displayName ?? dto.grantType,
      description: dto.description ?? null,
      enabled: dto.enabled ?? true,
      allowedClientTypes: normalizeArray(
        dto.allowedClientTypes ?? DEFAULT_CLIENT_TYPES,
      ),
      allowedApplicationTypes: normalizeArray(
        dto.allowedApplicationTypes ?? DEFAULT_APPLICATION_TYPES,
      ),
      requiresClientAuthentication: dto.requiresClientAuthentication ?? true,
      requiresGrantTypes: normalizeArray(dto.requiresGrantTypes ?? []),
      builtIn: false,
    });

    const saved = await this.customGrantRepo.save(grant);
    await this.auditRecorder?.recordAdminAction({
      tenantId,
      category: 'SYSTEM',
      action: 'CREATE',
      resourceType: 'custom-grant',
      resourceId: saved.id,
      metadata: {
        grantType: saved.grantType,
        enabled: saved.enabled,
      },
      auditContext,
    });

    return { id: saved.id };
  }

  async updateCustomGrant(
    tenantId: string,
    id: string,
    dto: UpdateCustomGrantDto,
    auditContext?: AuditContext,
  ): Promise<void> {
    this.logger.log(`Updating custom grant id=${id} in tenant=${tenantId}`);

    const grant = orThrow(
      await this.customGrantRepo.findById(id),
      new NotFoundException('Custom grant not found'),
      (g) => g.tenantId === tenantId,
    );

    if (dto.displayName !== undefined) grant.changeDisplayName(dto.displayName);
    if (dto.description !== undefined)
      grant.changeDescription(dto.description ?? null);
    if (dto.enabled !== undefined) grant.setEnabled(dto.enabled);
    if (dto.allowedClientTypes !== undefined)
      grant.changeAllowedClientTypes(normalizeArray(dto.allowedClientTypes));
    if (dto.allowedApplicationTypes !== undefined)
      grant.changeAllowedApplicationTypes(
        normalizeArray(dto.allowedApplicationTypes),
      );
    if (dto.requiresClientAuthentication !== undefined)
      grant.changeRequiresClientAuthentication(
        dto.requiresClientAuthentication,
      );
    if (dto.requiresGrantTypes !== undefined)
      grant.changeRequiresGrantTypes(normalizeArray(dto.requiresGrantTypes));

    await this.customGrantRepo.save(grant);
    await this.auditRecorder?.recordAdminAction({
      tenantId,
      category: 'SYSTEM',
      action: 'UPDATE',
      resourceType: 'custom-grant',
      resourceId: id,
      metadata: { changedFields: Object.keys(dto) },
      auditContext,
    });
  }

  async deleteCustomGrant(
    tenantId: string,
    id: string,
    auditContext?: AuditContext,
  ): Promise<void> {
    this.logger.log(`Deleting custom grant id=${id} in tenant=${tenantId}`);

    const grant = orThrow(
      await this.customGrantRepo.findById(id),
      new NotFoundException('Custom grant not found'),
      (g) => g.tenantId === tenantId,
    );
    if (grant.builtIn) {
      throw new BadRequestException('Built-in grant cannot be deleted');
    }

    await this.auditRecorder?.recordAdminAction({
      tenantId,
      category: 'SYSTEM',
      action: 'DELETE',
      resourceType: 'custom-grant',
      resourceId: id,
      metadata: { grantType: grant.grantType },
      auditContext,
    });
    await this.customGrantRepo.delete(id);
  }

  private assertGrantType(grantType: string): void {
    if (!isValidCustomGrantType(grantType)) {
      throw new BadRequestException('Invalid custom grant type');
    }
  }
}

function normalizeArray<T extends string>(items: T[]): T[] {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean) as T[])];
}
