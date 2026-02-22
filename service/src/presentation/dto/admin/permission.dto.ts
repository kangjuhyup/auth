export class CreatePermissionDto {
  code!: string;
  resource?: string;
  action?: string;
  description?: string;
}

export class UpdatePermissionDto {
  resource?: string;
  action?: string;
  description?: string;
}

export class PermissionResponse {
  id!: string;
  code!: string;
  resource?: string | null;
  action?: string | null;
  description?: string | null;
  createdAt!: Date;
  updatedAt!: Date;
}
