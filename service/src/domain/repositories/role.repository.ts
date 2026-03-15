import { RoleModel } from '../models/role';

export interface RoleListQuery {
  tenantId: string;
  page: number;
  limit: number;
}

export abstract class RoleRepository {
  abstract findById(id: string): Promise<RoleModel | null>;
  abstract findByCode(tenantId: string, code: string): Promise<RoleModel | null>;
  abstract list(query: RoleListQuery): Promise<{ items: RoleModel[]; total: number }>;
  abstract save(role: RoleModel): Promise<RoleModel>;
  abstract delete(id: string): Promise<void>;
}
