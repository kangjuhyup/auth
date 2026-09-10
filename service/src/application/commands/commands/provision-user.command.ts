export class ProvisionUserCommand {
  private constructor(
    public readonly username: string,
    public readonly password: string,
    public readonly idempotencyKey: string,
  ) {}

  static of(params: {
    username: string;
    password: string;
    idempotencyKey: string;
  }): ProvisionUserCommand {
    return new ProvisionUserCommand(
      params.username.trim(),
      params.password,
      params.idempotencyKey,
    );
  }
}
