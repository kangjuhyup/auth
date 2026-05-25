export type UserStatus = 'ACTIVE' | 'LOCKED' | 'DISABLED';

export class CreateUserDto {
  private constructor(
    public readonly username: string,
    public readonly password: string,
    public readonly temporaryPassword?: boolean,
    public readonly email?: string,
    public readonly phone?: string,
    public readonly status?: UserStatus,
  ) {}

  static of(params: {
    username: string;
    password: string;
    temporaryPassword?: boolean;
    email?: string;
    phone?: string;
    status?: UserStatus;
  }): CreateUserDto {
    return new CreateUserDto(
      params.username,
      params.password,
      params.temporaryPassword,
      params.email,
      params.phone,
      params.status,
    );
  }
}

export class UpdateUserDto {
  private constructor(
    public readonly email?: string,
    public readonly phone?: string,
    public readonly status?: UserStatus,
    public readonly mfaEnabled?: boolean,
  ) {}

  static of(params: {
    email?: string;
    phone?: string;
    status?: UserStatus;
    mfaEnabled?: boolean;
  }): UpdateUserDto {
    return new UpdateUserDto(
      params.email,
      params.phone,
      params.status,
      params.mfaEnabled,
    );
  }
}

export class UserListQuery {
  private constructor(
    public readonly page?: number,
    public readonly limit?: number,
    public readonly search?: string,
  ) {}

  static of(params: {
    page?: number;
    limit?: number;
    search?: string;
  }): UserListQuery {
    const normalizedSearch = params.search?.trim();

    return new UserListQuery(
      params.page,
      params.limit,
      normalizedSearch ? normalizedSearch : undefined,
    );
  }
}

export class UserResponse {
  private constructor(
    public readonly id: string,
    public readonly username: string,
    public readonly email: string | null | undefined,
    public readonly emailVerified: boolean,
    public readonly phone: string | null | undefined,
    public readonly phoneVerified: boolean,
    public readonly status: string,
    public readonly mfaEnabled: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static of(params: {
    id: string;
    username: string;
    email?: string | null;
    emailVerified: boolean;
    phone?: string | null;
    phoneVerified: boolean;
    status: string;
    mfaEnabled: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): UserResponse {
    return new UserResponse(
      params.id,
      params.username,
      params.email,
      params.emailVerified,
      params.phone,
      params.phoneVerified,
      params.status,
      params.mfaEnabled,
      params.createdAt,
      params.updatedAt,
    );
  }
}

export type UserConsentStatus = 'ACTIVE' | 'REVOKED';

export class UserConsentResponse {
  private constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly clientRefId: string,
    public readonly clientId: string,
    public readonly clientName: string,
    public readonly grantedScopes: string,
    public readonly grantedAt: Date,
    public readonly revokedAt: Date | null | undefined,
    public readonly status: UserConsentStatus,
  ) {}

  static of(params: {
    id: string;
    userId: string;
    clientRefId: string;
    clientId: string;
    clientName: string;
    grantedScopes: string;
    grantedAt: Date;
    revokedAt?: Date | null;
    status: UserConsentStatus;
  }): UserConsentResponse {
    return new UserConsentResponse(
      params.id,
      params.userId,
      params.clientRefId,
      params.clientId,
      params.clientName,
      params.grantedScopes,
      params.grantedAt,
      params.revokedAt,
      params.status,
    );
  }
}
