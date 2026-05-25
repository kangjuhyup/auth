export class AuditContext {
  private constructor(
    public readonly actorUserId?: string | null,
    public readonly actorUsername?: string | null,
    public readonly ipAddress?: string | null,
    public readonly userAgent?: string | null,
    public readonly correlationId?: string | null,
  ) {}

  static of(params: {
    actorUserId?: string | null;
    actorUsername?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    correlationId?: string | null;
  }): AuditContext {
    return new AuditContext(
      params.actorUserId,
      params.actorUsername,
      params.ipAddress,
      params.userAgent,
      params.correlationId,
    );
  }
}
