export class PaginationQuery {
  private constructor(
    public readonly page?: number,
    public readonly limit?: number,
  ) {}

  static of(params: { page?: number; limit?: number }): PaginationQuery {
    return new PaginationQuery(params.page, params.limit);
  }
}

export class PaginatedResult<T> {
  private constructor(
    public readonly items: T[],
    public readonly total: number,
    public readonly page: number,
    public readonly limit: number,
  ) {}

  static of<T>(params: {
    items: T[];
    total: number;
    page: number;
    limit: number;
  }): PaginatedResult<T> {
    return new PaginatedResult(
      params.items,
      params.total,
      params.page,
      params.limit,
    );
  }
}
