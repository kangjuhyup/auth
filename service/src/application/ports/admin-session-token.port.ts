export abstract class AdminSessionTokenPort {
  abstract issue(params: {
    tenantCode: string;
    userId: string;
  }): Promise<string | null>;

  abstract verify(params: {
    tenantCode: string;
    token: string;
  }): Promise<{ userId: string } | null>;
}
