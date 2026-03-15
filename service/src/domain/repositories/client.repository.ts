import { ClientModel } from '../models/client';

export interface ClientListQuery {
  tenantId: string;
  page: number;
  limit: number;
}

export abstract class ClientRepository {
  abstract findById(id: string): Promise<ClientModel | null>;
  abstract findByClientId(tenantId: string, clientId: string): Promise<ClientModel | null>;
  abstract list(query: ClientListQuery): Promise<{ items: ClientModel[]; total: number }>;
  abstract save(client: ClientModel): Promise<ClientModel>;
  abstract delete(id: string): Promise<void>;
}
