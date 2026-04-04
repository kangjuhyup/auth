import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ClientCommandPort } from '../ports/client-command.port';
import { CreateClientDto, UpdateClientDto } from '@application/dto';
import { ClientRepository } from '@domain/repositories';
import { ClientModel } from '@domain/models/client';
import { SymmetricCryptoPort } from '@application/ports/symmetric-crypto.port';

@Injectable()
export class ClientCommandHandler implements ClientCommandPort {
  private readonly logger = new Logger(ClientCommandHandler.name);

  constructor(
    private readonly clientRepo: ClientRepository,
    private readonly symmetricCrypto: SymmetricCryptoPort,
  ) {}

  async createClient(
    tenantId: string,
    dto: CreateClientDto,
  ): Promise<{ id: string }> {
    this.logger.log(`Creating client clientId=${dto.clientId} in tenant=${tenantId}`);

    const existing = await this.clientRepo.findByClientId(tenantId, dto.clientId);
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
    });

    const saved = await this.clientRepo.save(client);
    return { id: saved.id };
  }

  async updateClient(
    tenantId: string,
    id: string,
    dto: UpdateClientDto,
  ): Promise<void> {
    this.logger.log(`Updating client id=${id} in tenant=${tenantId}`);

    const client = await this.clientRepo.findById(id);
    if (!client) throw new NotFoundException('Client not found');
    if (client.tenantId !== tenantId) throw new NotFoundException('Client not found');

    if (dto.secret !== undefined) {
      client.changeSecretEnc(
        dto.secret ? this.symmetricCrypto.encrypt(dto.secret) : null,
      );
    }
    if (dto.name !== undefined) client.changeName(dto.name);
    if (dto.enabled !== undefined) client.setEnabled(dto.enabled);
    if (dto.redirectUris !== undefined) client.changeRedirectUris(dto.redirectUris);
    if (dto.grantTypes !== undefined) client.changeGrantTypes(dto.grantTypes);
    if (dto.responseTypes !== undefined) client.changeResponseTypes(dto.responseTypes);
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
    if (dto.skipConsent !== undefined)
      client.setSkipConsent(dto.skipConsent);

    await this.clientRepo.save(client);
  }

  async deleteClient(tenantId: string, id: string): Promise<void> {
    this.logger.log(`Deleting client id=${id} in tenant=${tenantId}`);

    const client = await this.clientRepo.findById(id);
    if (!client) throw new NotFoundException('Client not found');
    if (client.tenantId !== tenantId) throw new NotFoundException('Client not found');

    await this.clientRepo.delete(id);
  }
}
