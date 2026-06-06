import { OidcModelOrmEntity } from '@infrastructure/mikro-orm/entities/oidc-model';
import { OidcSessionIndexOrmEntity } from '@infrastructure/mikro-orm/entities/oidc-session-index';

type StringEntry = {
  type: 'string';
  value: string;
  expiresAt?: number;
};

type SetEntry = {
  type: 'set';
  value: Set<string>;
  expiresAt?: number;
};

type Entry = StringEntry | SetEntry;

function parseExpireArgs(args: unknown[]): number | undefined {
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === 'EX') {
      const seconds = Number(args[index + 1]);
      return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
    }
  }

  return undefined;
}

class InMemoryRedisMulti {
  private readonly commands: Array<() => Promise<unknown>> = [];

  constructor(private readonly redis: InMemoryRedis) {}

  set(key: string, value: string, ...args: unknown[]): this {
    this.commands.push(() => this.redis.set(key, value, ...args));
    return this;
  }

  expire(key: string, seconds: number): this {
    this.commands.push(() => this.redis.expire(key, seconds));
    return this;
  }

  del(key: string): this {
    this.commands.push(() => this.redis.del(key));
    return this;
  }

  sadd(key: string, member: string): this {
    this.commands.push(() => this.redis.sadd(key, member));
    return this;
  }

  srem(key: string, member: string): this {
    this.commands.push(() => this.redis.srem(key, member));
    return this;
  }

  async exec(): Promise<Array<[null, unknown]>> {
    const results: Array<[null, unknown]> = [];

    for (const command of this.commands) {
      results.push([null, await command()]);
    }

    return results;
  }
}

export class InMemoryRedis {
  private readonly entries = new Map<string, Entry>();

  private nowMs = Date.now();

  advanceTime(ms: number): void {
    this.nowMs += ms;
  }

  private currentTime(): number {
    return this.nowMs;
  }

  private isExpired(entry: Entry): boolean {
    return (
      entry.expiresAt !== undefined && entry.expiresAt <= this.currentTime()
    );
  }

  private getEntry(key: string): Entry | undefined {
    const entry = this.entries.get(key);
    if (!entry) {
      return undefined;
    }

    if (this.isExpired(entry)) {
      this.entries.delete(key);
      return undefined;
    }

    return entry;
  }

  async get(key: string): Promise<string | null> {
    const entry = this.getEntry(key);
    if (!entry || entry.type !== 'string') {
      return null;
    }

    return entry.value;
  }

  async set(key: string, value: string, ...args: unknown[]): Promise<'OK'> {
    const expireSeconds = parseExpireArgs(args);

    this.entries.set(key, {
      type: 'string',
      value,
      expiresAt:
        expireSeconds !== undefined
          ? this.currentTime() + expireSeconds * 1000
          : undefined,
    });

    return 'OK';
  }

  async expire(key: string, seconds: number): Promise<number> {
    const entry = this.getEntry(key);
    if (!entry) {
      return 0;
    }

    entry.expiresAt = this.currentTime() + seconds * 1000;
    return 1;
  }

  async ttl(key: string): Promise<number> {
    const entry = this.getEntry(key);
    if (!entry) {
      return -2;
    }

    if (entry.expiresAt === undefined) {
      return -1;
    }

    return Math.max(
      0,
      Math.ceil((entry.expiresAt - this.currentTime()) / 1000),
    );
  }

  async del(...keys: string[]): Promise<number> {
    let deleted = 0;

    for (const key of keys) {
      this.getEntry(key);
      if (this.entries.delete(key)) {
        deleted += 1;
      }
    }

    return deleted;
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    const existing = this.getEntry(key);
    const entry: SetEntry =
      existing && existing.type === 'set'
        ? existing
        : { type: 'set', value: new Set<string>() };

    this.entries.set(key, entry);

    let added = 0;
    for (const member of members) {
      if (!entry.value.has(member)) {
        entry.value.add(member);
        added += 1;
      }
    }

    return added;
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    const entry = this.getEntry(key);
    if (!entry || entry.type !== 'set') {
      return 0;
    }

    let removed = 0;
    for (const member of members) {
      if (entry.value.delete(member)) {
        removed += 1;
      }
    }

    return removed;
  }

  async smembers(key: string): Promise<string[]> {
    const entry = this.getEntry(key);
    if (!entry || entry.type !== 'set') {
      return [];
    }

    return [...entry.value];
  }

  multi(): InMemoryRedisMulti {
    return new InMemoryRedisMulti(this);
  }
}

type Where = Record<string, unknown>;

function matchesWhere(
  entity: OidcModelOrmEntity | OidcSessionIndexOrmEntity,
  where: Where,
): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (key === '$or' && Array.isArray(value)) {
      return value.some((candidate) => matchesWhere(entity, candidate));
    }

    const actual = (entity as unknown as Record<string, unknown>)[key];
    if (isRecord(value) && '$in' in value && Array.isArray(value.$in)) {
      return value.$in.includes(actual);
    }
    if (isRecord(value) && '$gt' in value) {
      return actual instanceof Date && value.$gt instanceof Date
        ? actual > value.$gt
        : String(actual) > String(value.$gt);
    }

    return actual === value;
  });
}

class LightweightRdbStore {
  oidcModels: OidcModelOrmEntity[] = [];
  sessionIndexes: OidcSessionIndexOrmEntity[] = [];
}

export class LightweightEntityManager {
  constructor(private readonly store = new LightweightRdbStore()) {}

  fork(): LightweightEntityManager {
    return new LightweightEntityManager(this.store);
  }

  async findOne(
    entity: typeof OidcModelOrmEntity | typeof OidcSessionIndexOrmEntity,
    where: Where,
  ): Promise<OidcModelOrmEntity | OidcSessionIndexOrmEntity | null> {
    return this.rowsFor(entity).find((row) => matchesWhere(row, where)) ?? null;
  }

  async find(
    entity: typeof OidcModelOrmEntity | typeof OidcSessionIndexOrmEntity,
    where: Where,
    options?: { orderBy?: Record<string, 'ASC' | 'DESC'> },
  ): Promise<Array<OidcModelOrmEntity | OidcSessionIndexOrmEntity>> {
    const rows = this.rowsFor(entity).filter((row) => matchesWhere(row, where));
    const [orderKey, direction] =
      Object.entries(options?.orderBy ?? {})[0] ?? [];
    if (orderKey) {
      rows.sort((left, right) => {
        const leftValue = (left as any)[orderKey];
        const rightValue = (right as any)[orderKey];
        const result =
          leftValue instanceof Date && rightValue instanceof Date
            ? leftValue.getTime() - rightValue.getTime()
            : String(leftValue).localeCompare(String(rightValue));
        return direction === 'DESC' ? -result : result;
      });
    }
    return rows;
  }

  create(
    EntityClass: typeof OidcModelOrmEntity | typeof OidcSessionIndexOrmEntity,
    data: Partial<OidcModelOrmEntity & OidcSessionIndexOrmEntity>,
  ): OidcModelOrmEntity | OidcSessionIndexOrmEntity {
    const entity = Object.assign(new EntityClass(), data);
    this.rowsFor(EntityClass).push(entity);
    return entity;
  }

  async flush(): Promise<void> {}

  async nativeDelete(
    entity: typeof OidcModelOrmEntity | typeof OidcSessionIndexOrmEntity,
    where: Where,
  ): Promise<number> {
    const rows = this.rowsFor(entity);
    const before = rows.length;
    const nextRows = rows.filter((row) => !matchesWhere(row, where));
    if (entity === OidcSessionIndexOrmEntity) {
      this.store.sessionIndexes = nextRows as OidcSessionIndexOrmEntity[];
    } else {
      this.store.oidcModels = nextRows as OidcModelOrmEntity[];
    }
    return before - nextRows.length;
  }

  private rowsFor(
    entity: typeof OidcModelOrmEntity | typeof OidcSessionIndexOrmEntity,
  ): Array<OidcModelOrmEntity | OidcSessionIndexOrmEntity> {
    return entity === OidcSessionIndexOrmEntity
      ? this.store.sessionIndexes
      : this.store.oidcModels;
  }
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
