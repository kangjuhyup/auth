import { ConflictException, Logger, NotFoundException } from '@nestjs/common';
import { ClientCommandPort } from '../ports/client-command.port';
import { CreateClientDto, UpdateClientDto } from '@application/dto';
import { ClientRepository } from '@domain/repositories';
import { ClientModel } from '@domain/models/client';

export class ClientCommandHandler implements ClientCommandPort {
  private readonly logger = new Logger(ClientCommandHandler.name);

  constructor(private readonly clientRepo: ClientRepository) {}

  async createClient(
    tenantId: string,
    dto: CreateClientDto,
  ): Promise<{ id: string }> {
    this.logger.log(`Creating client clientId=${dto.clientId} in tenant=${tenantId}`);

    const existing = await this.clientRepo.findByClientId(tenantId, dto.clientId);
    if (existing) throw new ConflictException('Client ID already exists');

    const client = new ClientModel({
      tenantId,
      clientId: dto.clientId,
      name: dto.name,
      type: dto.type ?? 'public',
      enabled: true,
      redirectUris: dto.redirectUris ?? [],
      grantTypes: dto.grantTypes ?? ['authorization_code'],
      responseTypes: dto.responseTypes ?? ['code'],
      tokenEndpointAuthMethod: dto.tokenEndpointAuthMethod ?? 'none',
      scope: dto.scope ?? 'openid',
      postLogoutRedirectUris: dto.postLogoutRedirectUris ?? [],
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
