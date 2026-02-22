export interface CreateGroupDto {
  code: string;
  name: string;
  parentId?: string;
}

export interface UpdateGroupDto {
  name?: string;
  parentId?: string | null;
}

export interface GroupResponse {
  id: string;
  code: string;
  name: string;
  parentId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
