import { ConsentModel } from '../models/consent';

export interface ConsentListQuery {
  tenantId: string;
  userId: string;
  page: number;
  limit: number;
}

export abstract class ConsentRepository {
  abstract findByTenantUserClient(
    tenantId: string,
    userId: string,
    clientRefId: string,
  ): Promise<ConsentModel | null>;

  abstract listAllByUser(
    tenantId: string,
    userId: string,
  ): Promise<ConsentModel[]>;

  abstract listByUser(
    query: ConsentListQuery,
  ): Promise<{ items: ConsentModel[]; total: number }>;

  abstract save(consent: ConsentModel): Promise<ConsentModel>;

  abstract delete(id: string): Promise<void>;
}
