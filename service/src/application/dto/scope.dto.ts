export class CreateScopeDto {
  private constructor(
    public readonly name: string,
    public readonly displayName?: string,
    public readonly description?: string | null,
    public readonly claimKeys?: string[],
    public readonly enabled?: boolean,
  ) {}

  static of(params: {
    name: string;
    displayName?: string;
    description?: string | null;
    claimKeys?: string[];
    enabled?: boolean;
  }): CreateScopeDto {
    return new CreateScopeDto(
      params.name,
      params.displayName,
      params.description,
      params.claimKeys,
      params.enabled,
    );
  }
}

export class UpdateScopeDto {
  private constructor(
    public readonly displayName?: string,
    public readonly description?: string | null,
    public readonly claimKeys?: string[],
    public readonly enabled?: boolean,
  ) {}

  static of(params: {
    displayName?: string;
    description?: string | null;
    claimKeys?: string[];
    enabled?: boolean;
  }): UpdateScopeDto {
    return new UpdateScopeDto(
      params.displayName,
      params.description,
      params.claimKeys,
      params.enabled,
    );
  }
}

export class ScopeResponse {
  private constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly displayName: string,
    public readonly description: string | null,
    public readonly claimKeys: string[],
    public readonly enabled: boolean,
    public readonly builtIn: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static of(params: {
    id: string;
    name: string;
    displayName: string;
    description: string | null;
    claimKeys: string[];
    enabled: boolean;
    builtIn: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): ScopeResponse {
    return new ScopeResponse(
      params.id,
      params.name,
      params.displayName,
      params.description,
      params.claimKeys,
      params.enabled,
      params.builtIn,
      params.createdAt,
      params.updatedAt,
    );
  }
}
