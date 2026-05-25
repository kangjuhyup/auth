export abstract class AdminSessionTokenPort {
  abstract issue(params: {
    tenantCode: string;
    userId: string;
  }): Promise<{ accessToken: string; refreshToken: string } | null>;

  abstract verify(params: {
    tenantCode: string;
    token: string;
  }): Promise<{ userId: string } | null>;

  abstract refresh(params: {
    tenantCode: string;
    refreshToken: string;
  }): Promise<{
    accessToken: string;
    refreshToken: string;
    userId: string;
  } | null>;
}
