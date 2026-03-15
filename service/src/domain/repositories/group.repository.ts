import { GroupModel } from '../models/group';

export interface GroupListQuery {
  tenantId: string;
  page: number;
  limit: number;
}

export abstract class GroupRepository {
  abstract findById(id: string): Promise<GroupModel | null>;
  abstract findByCode(tenantId: string, code: string): Promise<GroupModel | null>;
  abstract list(query: GroupListQuery): Promise<{ items: GroupModel[]; total: number }>;
  abstract save(group: GroupModel): Promise<GroupModel>;
  abstract delete(id: string): Promise<void>;
}
