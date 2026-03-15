import { Injectable } from '@nestjs/common';
import { ClientQueryPort } from '../ports/client-query.port';
import { ClientRepository } from '@domain/repositories';

@Injectable()
export class ClientQueryHandler implements ClientQueryPort {
  constructor(private readonly clientRepo: ClientRepository) {}

  async getAllowedResources(params: {
    tenantId: string;
    clientId: string;
  }): Promise<string[]> {
    const client = await this.clientRepo.findByClientId(
      params.tenantId,
      params.clientId,
    );

    if (!client) return [];

    return client.allowedResources;
  }
}
