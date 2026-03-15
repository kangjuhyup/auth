import { PermissionModel } from '../models/permission';

export interface RolePermissionListQuery {
  roleId: string;
  page: number;
  limit: number;
}

export abstract class RolePermissionRepository {
  abstract add(params: { roleId: string; permissionId: string }): Promise<void>;
  abstract remove(params: { roleId: string; permissionId: string }): Promise<void>;
  abstract exists(params: { roleId: string; permissionId: string }): Promise<boolean>;
  abstract listByRole(
    query: RolePermissionListQuery,
  ): Promise<{ items: PermissionModel[]; total: number }>;
}
