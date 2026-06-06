export class CreateRoleDto {
  private constructor(
    public readonly code: string,
    public readonly name: string,
    public readonly description?: string,
  ) {}

  static of(params: {
    code: string;
    name: string;
    description?: string;
  }): CreateRoleDto {
    return new CreateRoleDto(params.code, params.name, params.description);
  }
}

export class UpdateRoleDto {
  private constructor(
    public readonly name?: string,
    public readonly description?: string,
  ) {}

  static of(params: { name?: string; description?: string }): UpdateRoleDto {
    return new UpdateRoleDto(params.name, params.description);
  }
}

export class RoleResponse {
  private constructor(
    public readonly id: string,
    public readonly code: string,
    public readonly name: string,
    public readonly description: string | null | undefined,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static of(params: {
    id: string;
    code: string;
    name: string;
    description?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): RoleResponse {
    return new RoleResponse(
      params.id,
      params.code,
      params.name,
      params.description,
      params.createdAt,
      params.updatedAt,
    );
  }
}
