import { PermissionModel } from '../models/permission';

export interface PermissionListQuery {
  tenantId: string;
  page: number;
  limit: number;
}

export abstract class PermissionRepository {
  abstract findById(id: string): Promise<PermissionModel | null>;
  abstract findByCode(tenantId: string, code: string): Promise<PermissionModel | null>;
  abstract list(query: PermissionListQuery): Promise<{ items: PermissionModel[]; total: number }>;
  abstract save(permission: PermissionModel): Promise<PermissionModel>;
  abstract delete(id: string): Promise<void>;
}
