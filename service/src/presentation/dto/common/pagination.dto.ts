export class PaginationQuery {
  page?: number;
  limit?: number;
}

export class PaginatedResult<T> {
  items!: T[];
  total!: number;
  page!: number;
  limit!: number;
}
