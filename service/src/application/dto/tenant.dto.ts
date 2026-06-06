export class TenantContext {
  private constructor(
    public readonly id: string,
    public readonly code: string,
    public readonly name: string,
  ) {}

  static of(params: { id: string; code: string; name: string }): TenantContext {
    return new TenantContext(params.id, params.code, params.name);
  }
}

export class CreateTenantDto {
  private constructor(
    public readonly code: string,
    public readonly name: string,
    public readonly signupPolicy?: 'invite' | 'open',
    public readonly requirePhoneVerify?: boolean,
    public readonly brandName?: string,
  ) {}

  static of(params: {
    code: string;
    name: string;
    signupPolicy?: 'invite' | 'open';
    requirePhoneVerify?: boolean;
    brandName?: string;
  }): CreateTenantDto {
    return new CreateTenantDto(
      params.code,
      params.name,
      params.signupPolicy,
      params.requirePhoneVerify,
      params.brandName,
    );
  }
}

export class UpdateTenantDto {
  private constructor(
    public readonly name?: string,
    public readonly signupPolicy?: 'invite' | 'open',
    public readonly requirePhoneVerify?: boolean,
    public readonly brandName?: string,
  ) {}

  static of(params: {
    name?: string;
    signupPolicy?: 'invite' | 'open';
    requirePhoneVerify?: boolean;
    brandName?: string;
  }): UpdateTenantDto {
    return new UpdateTenantDto(
      params.name,
      params.signupPolicy,
      params.requirePhoneVerify,
      params.brandName,
    );
  }
}

export class TenantResponse {
  private constructor(
    public readonly id: string,
    public readonly code: string,
    public readonly name: string,
    public readonly signupPolicy: string,
    public readonly requirePhoneVerify: boolean,
    public readonly brandName: string | null | undefined,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static of(params: {
    id: string;
    code: string;
    name: string;
    signupPolicy: string;
    requirePhoneVerify: boolean;
    brandName?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): TenantResponse {
    return new TenantResponse(
      params.id,
      params.code,
      params.name,
      params.signupPolicy,
      params.requirePhoneVerify,
      params.brandName,
      params.createdAt,
      params.updatedAt,
    );
  }
}
