export class CreateGroupDto {
  private constructor(
    public readonly code: string,
    public readonly name: string,
    public readonly parentId?: string,
  ) {}

  static of(params: {
    code: string;
    name: string;
    parentId?: string;
  }): CreateGroupDto {
    return new CreateGroupDto(params.code, params.name, params.parentId);
  }
}

export class UpdateGroupDto {
  private constructor(
    public readonly name?: string,
    public readonly parentId?: string | null,
  ) {}

  static of(params: {
    name?: string;
    parentId?: string | null;
  }): UpdateGroupDto {
    return new UpdateGroupDto(params.name, params.parentId);
  }
}

export class GroupResponse {
  private constructor(
    public readonly id: string,
    public readonly code: string,
    public readonly name: string,
    public readonly parentId: string | null | undefined,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static of(params: {
    id: string;
    code: string;
    name: string;
    parentId?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): GroupResponse {
    return new GroupResponse(
      params.id,
      params.code,
      params.name,
      params.parentId,
      params.createdAt,
      params.updatedAt,
    );
  }
}
