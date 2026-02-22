export class CreateRoleDto {
  code!: string;
  name!: string;
  description?: string;
}

export class UpdateRoleDto {
  name?: string;
  description?: string;
}

export class RoleResponse {
  id!: string;
  code!: string;
  name!: string;
  description?: string | null;
  createdAt!: Date;
  updatedAt!: Date;
}
