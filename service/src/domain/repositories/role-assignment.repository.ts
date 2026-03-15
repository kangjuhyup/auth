import { RoleModel } from '../models/role';

export abstract class RoleAssignmentRepository {
  abstract assignToUser(params: {
    userId: string;
    roleId: string;
  }): Promise<void>;

  abstract removeFromUser(params: {
    userId: string;
    roleId: string;
  }): Promise<void>;

  abstract assignToGroup(params: {
    groupId: string;
    roleId: string;
  }): Promise<void>;

  abstract removeFromGroup(params: {
    groupId: string;
    roleId: string;
  }): Promise<void>;

  abstract listForUser(userId: string): Promise<RoleModel[]>;
  abstract listForGroup(groupId: string): Promise<RoleModel[]>;
}
