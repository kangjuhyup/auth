import { GroupModel } from '../models/group';

export abstract class UserGroupMembershipRepository {
  abstract add(params: { userId: string; groupId: string }): Promise<void>;
  abstract remove(params: { userId: string; groupId: string }): Promise<void>;
  abstract exists(params: {
    userId: string;
    groupId: string;
  }): Promise<boolean>;
  abstract listGroupsForUser(userId: string): Promise<GroupModel[]>;
}
