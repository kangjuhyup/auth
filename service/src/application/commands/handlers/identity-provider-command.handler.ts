import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { IdentityProviderCommandPort } from '../ports/identity-provider-command.port';
import {
  CreateIdentityProviderDto,
  AuditContext,
  UpdateIdentityProviderDto,
} from '@application/dto';
import { IdentityProviderRepository } from '@domain/repositories';
import { IdentityProviderModel } from '@domain/models/identity-provider';
import { orThrow } from '@domain/utils';
import { AuditRecorder } from '@application/services/audit-recorder';

@Injectable()
export class IdentityProviderCommandHandler implements IdentityProviderCommandPort {
  private readonly logger = new Logger(IdentityProviderCommandHandler.name);

  constructor(
    private readonly idpRepo: IdentityProviderRepository,
    private readonly auditRecorder?: AuditRecorder,
  ) {}

  async createIdentityProvider(
    tenantId: string,
    dto: CreateIdentityProviderDto,
    auditContext?: AuditContext,
  ): Promise<{ id: string }> {
    this.logger.log(`Creating IdP provider=${dto.provider} tenant=${tenantId}`);

    const existing = await this.idpRepo.findByTenantAndProvider(
      tenantId,
      dto.provider,
    );
    if (existing) {
      throw new ConflictException(
        'Identity provider already exists for tenant',
      );
    }

    const model = new IdentityProviderModel({
      tenantId,
      provider: dto.provider,
      protocol: dto.protocol ?? 'oauth2',
      displayName: dto.displayName,
      clientId: dto.clientId,
      clientSecret: dto.clientSecret ?? null,
      redirectUri: dto.redirectUri,
      enabled: dto.enabled ?? true,
      oauthConfig: dto.oauthConfig ?? null,
      samlConfig: dto.samlConfig ?? null,
    });

    const saved = await this.idpRepo.save(model);
    await this.auditRecorder?.recordAdminAction({
      tenantId,
      action: 'CREATE',
      resourceType: 'identity-provider',
      resourceId: saved.id,
      metadata: {
        provider: saved.provider,
        protocol: saved.protocol,
        enabled: saved.enabled,
      },
      auditContext,
    });
    return { id: saved.id };
  }

  async updateIdentityProvider(
    tenantId: string,
    id: string,
    dto: UpdateIdentityProviderDto,
    auditContext?: AuditContext,
  ): Promise<void> {
    this.logger.log(`Updating IdP id=${id} tenant=${tenantId}`);

    const model = orThrow(
      await this.idpRepo.findByIdForTenant(tenantId, id),
      new NotFoundException('Identity provider not found'),
    );

    if (dto.displayName !== undefined) {
      model.changeDisplayName(dto.displayName);
    }
    if (dto.protocol !== undefined) {
      model.configureProtocol({
        protocol: dto.protocol,
        oauthConfig:
          dto.oauthConfig !== undefined ? dto.oauthConfig : model.oauthConfig,
        samlConfig:
          dto.samlConfig !== undefined ? dto.samlConfig : model.samlConfig,
      });
    }
    if (dto.clientId !== undefined) {
      model.changeClientId(dto.clientId);
    }
    if (dto.clientSecret !== undefined) {
      model.changeClientSecret(dto.clientSecret);
    }
    if (dto.redirectUri !== undefined) {
      model.changeRedirectUri(dto.redirectUri);
    }
    if (dto.enabled !== undefined) {
      model.setEnabled(dto.enabled);
    }
    if (dto.oauthConfig !== undefined && dto.protocol === undefined) {
      model.changeOauthConfig(dto.oauthConfig);
    }
    if (dto.samlConfig !== undefined && dto.protocol === undefined) {
      model.changeSamlConfig(dto.samlConfig);
    }

    await this.idpRepo.save(model);
    await this.auditRecorder?.recordAdminAction({
      tenantId,
      action: 'UPDATE',
      resourceType: 'identity-provider',
      resourceId: id,
      metadata: {
        changedFields: Object.keys(dto).filter((key) => key !== 'clientSecret'),
        clientSecretChanged: dto.clientSecret !== undefined,
      },
      auditContext,
    });
  }

  async deleteIdentityProvider(
    tenantId: string,
    id: string,
    auditContext?: AuditContext,
  ): Promise<void> {
    this.logger.log(`Deleting IdP id=${id} tenant=${tenantId}`);

    orThrow(
      await this.idpRepo.findByIdForTenant(tenantId, id),
      new NotFoundException('Identity provider not found'),
    );

    await this.auditRecorder?.recordAdminAction({
      tenantId,
      action: 'DELETE',
      resourceType: 'identity-provider',
      resourceId: id,
      auditContext,
    });
    await this.idpRepo.delete(id);
  }
}
