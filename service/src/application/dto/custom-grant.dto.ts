import type { ApplicationType, ClientType } from '@domain/models/client';

export class CreateCustomGrantDto {
  private constructor(
    public readonly grantType: string,
    public readonly displayName?: string,
    public readonly description?: string | null,
    public readonly enabled?: boolean,
    public readonly allowedClientTypes?: ClientType[],
    public readonly allowedApplicationTypes?: ApplicationType[],
    public readonly requiresClientAuthentication?: boolean,
    public readonly requiresGrantTypes?: string[],
  ) {}

  static of(params: {
    grantType: string;
    displayName?: string;
    description?: string | null;
    enabled?: boolean;
    allowedClientTypes?: ClientType[];
    allowedApplicationTypes?: ApplicationType[];
    requiresClientAuthentication?: boolean;
    requiresGrantTypes?: string[];
  }): CreateCustomGrantDto {
    return new CreateCustomGrantDto(
      params.grantType,
      params.displayName,
      params.description,
      params.enabled,
      params.allowedClientTypes,
      params.allowedApplicationTypes,
      params.requiresClientAuthentication,
      params.requiresGrantTypes,
    );
  }
}

export class UpdateCustomGrantDto {
  private constructor(
    public readonly displayName?: string,
    public readonly description?: string | null,
    public readonly enabled?: boolean,
    public readonly allowedClientTypes?: ClientType[],
    public readonly allowedApplicationTypes?: ApplicationType[],
    public readonly requiresClientAuthentication?: boolean,
    public readonly requiresGrantTypes?: string[],
  ) {}

  static of(params: {
    displayName?: string;
    description?: string | null;
    enabled?: boolean;
    allowedClientTypes?: ClientType[];
    allowedApplicationTypes?: ApplicationType[];
    requiresClientAuthentication?: boolean;
    requiresGrantTypes?: string[];
  }): UpdateCustomGrantDto {
    return new UpdateCustomGrantDto(
      params.displayName,
      params.description,
      params.enabled,
      params.allowedClientTypes,
      params.allowedApplicationTypes,
      params.requiresClientAuthentication,
      params.requiresGrantTypes,
    );
  }
}

export class CustomGrantResponse {
  private constructor(
    public readonly id: string,
    public readonly grantType: string,
    public readonly displayName: string,
    public readonly description: string | null,
    public readonly enabled: boolean,
    public readonly allowedClientTypes: ClientType[],
    public readonly allowedApplicationTypes: ApplicationType[],
    public readonly requiresClientAuthentication: boolean,
    public readonly requiresGrantTypes: string[],
    public readonly builtIn: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static of(params: {
    id: string;
    grantType: string;
    displayName: string;
    description: string | null;
    enabled: boolean;
    allowedClientTypes: ClientType[];
    allowedApplicationTypes: ApplicationType[];
    requiresClientAuthentication: boolean;
    requiresGrantTypes: string[];
    builtIn: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): CustomGrantResponse {
    return new CustomGrantResponse(
      params.id,
      params.grantType,
      params.displayName,
      params.description,
      params.enabled,
      params.allowedClientTypes,
      params.allowedApplicationTypes,
      params.requiresClientAuthentication,
      params.requiresGrantTypes,
      params.builtIn,
      params.createdAt,
      params.updatedAt,
    );
  }
}
