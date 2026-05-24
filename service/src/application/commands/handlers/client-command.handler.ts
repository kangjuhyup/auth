import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ClientCommandPort } from '../ports/client-command.port';
import {
  CreateClientDto,
  UpdateClientAuthPolicyDto,
  UpdateClientDto,
} from '@application/dto';
import {
  ClientAuthPolicyRepository,
  ClientRepository,
} from '@domain/repositories';
import { ClientModel } from '@domain/models/client';
import { ClientAuthPolicyModel } from '@domain/models/client-auth-policy';
import type { AuthMethod, MfaMethod } from '@domain/models/client-auth-policy';
import { SymmetricCryptoPort } from '@application/ports/symmetric-crypto.port';
import { orThrow } from '@domain/utils';
import { AuditRecorder } from '@application/services/audit-recorder';

@Injectable()
export class ClientCommandHandler implements ClientCommandPort {
  private readonly logger = new Logger(ClientCommandHandler.name);

  constructor(
    private readonly clientRepo: ClientRepository,
    private readonly clientAuthPolicyRepo: ClientAuthPolicyRepository,
    private readonly symmetricCrypto: SymmetricCryptoPort,
    private readonly auditRecorder?: AuditRecorder,
  ) {}

  async createClient(
    tenantId: string,
    dto: CreateClientDto,
  ): Promise<{ id: string }> {
    this.logger.log(
      `Creating client clientId=${dto.clientId} in tenant=${tenantId}`,
    );

    const existing = await this.clientRepo.findByClientId(
      tenantId,
      dto.clientId,
    );
    if (existing) throw new ConflictException('Client ID already exists');

    const secretEnc = dto.secret
      ? this.symmetricCrypto.encrypt(dto.secret)
      : null;

    const client = new ClientModel({
      tenantId,
      clientId: dto.clientId,
      secretEnc,
      name: dto.name,
      type: dto.type ?? 'public',
      enabled: true,
      redirectUris: dto.redirectUris ?? [],
      grantTypes: dto.grantTypes ?? ['authorization_code'],
      responseTypes: dto.responseTypes ?? ['code'],
      tokenEndpointAuthMethod: dto.tokenEndpointAuthMethod ?? 'none',
      scope: dto.scope ?? 'openid',
      postLogoutRedirectUris: dto.postLogoutRedirectUris ?? [],
      applicationType: dto.applicationType ?? 'web',
      backchannelLogoutUri: dto.backchannelLogoutUri ?? null,
      frontchannelLogoutUri: dto.frontchannelLogoutUri ?? null,
      allowedResources: dto.allowedResources ?? [],
      skipConsent: dto.skipConsent ?? false,
      accessTokenTtlSec: dto.accessTokenTtlSec ?? null,
      refreshTokenTtlSec: dto.refreshTokenTtlSec ?? null,
    });

    const saved = await this.clientRepo.save(client);
    await this.clientAuthPolicyRepo.save(
      this.createDefaultAuthPolicy(tenantId, saved.id),
    );
    await this.auditRecorder?.recordAdminAction({
      tenantId,
      action: 'CREATE',
      resourceType: 'client',
      resourceId: saved.id,
      metadata: {
        clientId: saved.clientId,
        type: saved.type,
        tokenEndpointAuthMethod: saved.tokenEndpointAuthMethod,
      },
    });
    return { id: saved.id };
  }

  async updateClient(
    tenantId: string,
    id: string,
    dto: UpdateClientDto,
  ): Promise<void> {
    this.logger.log(`Updating client id=${id} in tenant=${tenantId}`);

    const client = orThrow(
      await this.clientRepo.findById(id),
      new NotFoundException('Client not found'),
      (c) => c.tenantId === tenantId,
    );

    if (dto.secret !== undefined) {
      client.changeSecretEnc(
        dto.secret ? this.symmetricCrypto.encrypt(dto.secret) : null,
      );
    }
    if (dto.name !== undefined) client.changeName(dto.name);
    if (dto.enabled !== undefined) client.setEnabled(dto.enabled);
    if (dto.redirectUris !== undefined)
      client.changeRedirectUris(dto.redirectUris);
    if (dto.grantTypes !== undefined) client.changeGrantTypes(dto.grantTypes);
    if (dto.responseTypes !== undefined)
      client.changeResponseTypes(dto.responseTypes);
    if (dto.tokenEndpointAuthMethod !== undefined)
      client.changeTokenEndpointAuthMethod(dto.tokenEndpointAuthMethod);
    if (dto.scope !== undefined) client.changeScope(dto.scope);
    if (dto.postLogoutRedirectUris !== undefined)
      client.changePostLogoutRedirectUris(dto.postLogoutRedirectUris);
    if (dto.applicationType !== undefined)
      client.changeApplicationType(dto.applicationType);
    if (dto.backchannelLogoutUri !== undefined)
      client.changeBackchannelLogoutUri(dto.backchannelLogoutUri ?? null);
    if (dto.frontchannelLogoutUri !== undefined)
      client.changeFrontchannelLogoutUri(dto.frontchannelLogoutUri ?? null);
    if (dto.allowedResources !== undefined)
      client.changeAllowedResources(dto.allowedResources);
    if (dto.skipConsent !== undefined) client.setSkipConsent(dto.skipConsent);
    if (dto.accessTokenTtlSec !== undefined)
      client.changeAccessTokenTtlSec(dto.accessTokenTtlSec);
    if (dto.refreshTokenTtlSec !== undefined)
      client.changeRefreshTokenTtlSec(dto.refreshTokenTtlSec);

    await this.clientRepo.save(client);
    await this.auditRecorder?.recordAdminAction({
      tenantId,
      action: 'UPDATE',
      resourceType: 'client',
      resourceId: id,
      metadata: {
        changedFields: Object.keys(dto).filter((key) => key !== 'secret'),
        secretChanged: dto.secret !== undefined,
      },
    });
  }

  async updateClientAuthPolicy(
    tenantId: string,
    id: string,
    dto: UpdateClientAuthPolicyDto,
  ): Promise<void> {
    this.logger.log(
      `Updating client auth policy id=${id} in tenant=${tenantId}`,
    );

    const client = orThrow(
      await this.clientRepo.findById(id),
      new NotFoundException('Client not found'),
      (c) => c.tenantId === tenantId,
    );

    const policy =
      (await this.clientAuthPolicyRepo.findByClientRefId(id)) ??
      this.createDefaultAuthPolicy(tenantId, client.id);

    if (dto.allowedAuthMethods !== undefined) {
      policy.changeAllowedAuthMethods(dto.allowedAuthMethods as AuthMethod[]);
    }
    if (dto.defaultAcr !== undefined) policy.changeDefaultAcr(dto.defaultAcr);
    if (dto.mfaRequired !== undefined)
      policy.changeMfaRequired(dto.mfaRequired);
    if (dto.allowedMfaMethods !== undefined) {
      policy.changeAllowedMfaMethods(dto.allowedMfaMethods as MfaMethod[]);
    }
    if (dto.maxSessionDurationSec !== undefined) {
      policy.changeMaxSessionDurationSec(dto.maxSessionDurationSec);
    }
    if (dto.consentRequired !== undefined) {
      policy.changeConsentRequired(dto.consentRequired);
    }
    if (dto.requireAuthTime !== undefined) {
      policy.changeRequireAuthTime(dto.requireAuthTime);
    }
    if (dto.allowedIdpProviderKeys !== undefined) {
      policy.changeAllowedIdpProviderKeys(dto.allowedIdpProviderKeys);
    }
    if (dto.reauthenticationIntervalSec !== undefined) {
      policy.changeReauthenticationIntervalSec(dto.reauthenticationIntervalSec);
    }
    if (dto.refreshTokenRotationEnabled !== undefined) {
      policy.changeRefreshTokenRotationEnabled(dto.refreshTokenRotationEnabled);
    }
    if (dto.refreshTokenReuseAction !== undefined) {
      policy.changeRefreshTokenReuseAction(dto.refreshTokenReuseAction);
    }

    await this.clientAuthPolicyRepo.save(policy);
    await this.auditRecorder?.recordAdminAction({
      tenantId,
      action: 'CONFIG_CHANGE',
      resourceType: 'client-auth-policy',
      resourceId: id,
      metadata: {
        changedFields: Object.keys(dto),
      },
    });
  }

  async deleteClient(tenantId: string, id: string): Promise<void> {
    this.logger.log(`Deleting client id=${id} in tenant=${tenantId}`);

    orThrow(
      await this.clientRepo.findById(id),
      new NotFoundException('Client not found'),
      (c) => c.tenantId === tenantId,
    );

    await this.auditRecorder?.recordAdminAction({
      tenantId,
      action: 'DELETE',
      resourceType: 'client',
      resourceId: id,
    });
    await this.clientRepo.delete(id);
  }

  private createDefaultAuthPolicy(
    tenantId: string,
    clientRefId: string,
  ): ClientAuthPolicyModel {
    return new ClientAuthPolicyModel({
      tenantId,
      clientRefId,
      allowedAuthMethods: ['password'],
      defaultAcr: 'urn:auth:pwd',
      mfaRequired: false,
      allowedMfaMethods: ['totp'],
      maxSessionDurationSec: null,
      consentRequired: true,
      requireAuthTime: false,
      allowedIdpProviderKeys: null,
      reauthenticationIntervalSec: null,
      refreshTokenRotationEnabled: true,
      refreshTokenReuseAction: 'revoke_grant',
    });
  }
}
