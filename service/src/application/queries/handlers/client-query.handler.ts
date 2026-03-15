import { Injectable } from '@nestjs/common';
import { ClientQueryPort } from '../ports/client-query.port';

@Injectable()
export class ClientQueryHandler implements ClientQueryPort {
  getAllowedResources(params: {
    tenantId: string;
    clientId: string;
  }): Promise<string[]> {
    throw new Error('Method not implemented.');
  }
}
