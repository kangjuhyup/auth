export abstract class AdminSessionPort {
  abstract issueAdminToken(params: {
    username: string;
    password: string;
  }): Promise<{ token: string; username: string } | null>;

  abstract verifyAdminToken(token: string): Promise<boolean>;
}
