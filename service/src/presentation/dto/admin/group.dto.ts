export class CreateGroupDto {
  code!: string;
  name!: string;
  parentId?: string;
}

export class UpdateGroupDto {
  name?: string;
  parentId?: string | null;
}

export class GroupResponse {
  id!: string;
  code!: string;
  name!: string;
  parentId?: string | null;
  createdAt!: Date;
  updatedAt!: Date;
}
