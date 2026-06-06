export class CreatePermissionDto {
  private constructor(
    public readonly code: string,
    public readonly resource?: string,
    public readonly action?: string,
    public readonly description?: string,
  ) {}

  static of(params: {
    code: string;
    resource?: string;
    action?: string;
    description?: string;
  }): CreatePermissionDto {
    return new CreatePermissionDto(
      params.code,
      params.resource,
      params.action,
      params.description,
    );
  }
}

export class UpdatePermissionDto {
  private constructor(
    public readonly resource?: string,
    public readonly action?: string,
    public readonly description?: string,
  ) {}

  static of(params: {
    resource?: string;
    action?: string;
    description?: string;
  }): UpdatePermissionDto {
    return new UpdatePermissionDto(
      params.resource,
      params.action,
      params.description,
    );
  }
}

export class PermissionResponse {
  private constructor(
    public readonly id: string,
    public readonly code: string,
    public readonly resource: string | null | undefined,
    public readonly action: string | null | undefined,
    public readonly description: string | null | undefined,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static of(params: {
    id: string;
    code: string;
    resource?: string | null;
    action?: string | null;
    description?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): PermissionResponse {
    return new PermissionResponse(
      params.id,
      params.code,
      params.resource,
      params.action,
      params.description,
      params.createdAt,
      params.updatedAt,
    );
  }
}
