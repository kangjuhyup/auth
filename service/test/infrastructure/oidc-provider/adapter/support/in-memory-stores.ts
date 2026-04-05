import { OidcModelOrmEntity } from '@infrastructure/mikro-orm/entities/oidc-model';

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
    return entry.expiresAt !== undefined && entry.expiresAt <= this.currentTime();
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

    return Math.max(0, Math.ceil((entry.expiresAt - this.currentTime()) / 1000));
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
  entity: OidcModelOrmEntity,
  where: Where,
): boolean {
  return Object.entries(where).every(
    ([key, value]) => (entity as unknown as Record<string, unknown>)[key] === value,
  );
}

class LightweightRdbStore {
  rows: OidcModelOrmEntity[] = [];
}

export class LightweightEntityManager {
  constructor(private readonly store = new LightweightRdbStore()) {}

  fork(): LightweightEntityManager {
    return new LightweightEntityManager(this.store);
  }

  async findOne(
    _entity: typeof OidcModelOrmEntity,
    where: Where,
  ): Promise<OidcModelOrmEntity | null> {
    return this.store.rows.find((row) => matchesWhere(row, where)) ?? null;
  }

  create(
    EntityClass: typeof OidcModelOrmEntity,
    data: Partial<OidcModelOrmEntity>,
  ): OidcModelOrmEntity {
    const entity = Object.assign(new EntityClass(), data);
    this.store.rows.push(entity);
    return entity;
  }

  async flush(): Promise<void> {}

  async nativeDelete(
    _entity: typeof OidcModelOrmEntity,
    where: Where,
  ): Promise<number> {
    const before = this.store.rows.length;
    this.store.rows = this.store.rows.filter((row) => !matchesWhere(row, where));
    return before - this.store.rows.length;
  }
}
