export abstract class RoleInheritRepository {
  abstract addInheritance(params: {
    parentRoleId: string;
    childRoleId: string;
  }): Promise<void>;

  abstract removeInheritance(params: {
    parentRoleId: string;
    childRoleId: string;
  }): Promise<void>;

  abstract getChildRoleIds(parentRoleId: string): Promise<string[]>;

  abstract getParentRoleIds(childRoleId: string): Promise<string[]>;

  /**
   * 재귀적으로 모든 상속된 역할 ID를 반환한다 (자기 자신 포함).
   */
  abstract resolveAllRoleIds(roleId: string): Promise<string[]>;
}
