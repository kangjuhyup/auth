import type { EntityManager } from '@mikro-orm/core';
import type { AdapterPayload } from 'oidc-provider';
import type { Redis } from 'ioredis';
import type { TenantRepository } from '@domain/repositories';
import { OidcSessionIndexOrmEntity } from '@infrastructure/mikro-orm/entities/oidc-session-index';
import { extractOidcSessionDescriptor } from './oidc-session-payload';

export type OidcSessionRecord = Readonly<{
  sessionId: string;
  tenantId: string;
  clientId: string;
  accountId: string;
  grantId: string | null;
  createdAt: Date;
  expiresAt: Date | null;
}>;

export interface OidcSessionIndexStore {
  upsertSession(
    sessionId: string,
    payload: AdapterPayload,
    expiresAt: Date | null,
  ): Promise<void>;
  destroySession(sessionId: string): Promise<void>;
  deleteByGrantIds(grantIds: string[]): Promise<void>;
}

export class RdbOidcSessionIndexStore implements OidcSessionIndexStore {
  private tenantIdPromise: Promise<string | null> | null = null;

  constructor(
    private readonly em: EntityManager,
    private readonly tenantCode: string,
    private readonly tenantRepository: TenantRepository,
  ) {}

  async upsertSession(
    sessionId: string,
    payload: AdapterPayload,
    expiresAt: Date | null,
  ): Promise<void> {
    const tenantId = await this.resolveTenantId();
    const descriptor = extractOidcSessionDescriptor(payload);
    const em = this.em.fork();

    await em.nativeDelete(OidcSessionIndexOrmEntity, { sessionId });
    if (!tenantId || !descriptor) {
      await em.flush();
      return;
    }

    for (const authorization of descriptor.authorizations) {
      em.create(OidcSessionIndexOrmEntity, {
        sessionId,
        tenantId,
        clientId: authorization.clientId,
        accountId: descriptor.accountId,
        grantId: authorization.grantId,
        expiresAt,
        createdAt: new Date(),
      });
    }

    await em.flush();
  }

  async destroySession(sessionId: string): Promise<void> {
    const em = this.em.fork();
    await em.nativeDelete(OidcSessionIndexOrmEntity, { sessionId });
  }

  async deleteByGrantIds(grantIds: string[]): Promise<void> {
    if (grantIds.length === 0) return;
    const em = this.em.fork();
    await em.nativeDelete(OidcSessionIndexOrmEntity, {
      grantId: { $in: grantIds },
    } as any);
  }

  private resolveTenantId(): Promise<string | null> {
    this.tenantIdPromise ??= this.tenantRepository
      .findByCode(this.tenantCode)
      .then((tenant) => tenant?.id ?? null)
      .catch(() => null);
    return this.tenantIdPromise;
  }
}

type RedisSessionIndexEntry = {
  sessionId: string;
  tenantId: string;
  clientId: string;
  accountId: string;
  grantId: string | null;
  createdAt: string;
  expiresAt: string | null;
};

export class RedisOidcSessionIndexStore implements OidcSessionIndexStore {
  private tenantIdPromise: Promise<string | null> | null = null;

  constructor(
    private readonly redis: Redis,
    private readonly tenantCode: string,
    private readonly tenantRepository: TenantRepository,
  ) {}

  async upsertSession(
    sessionId: string,
    payload: AdapterPayload,
    expiresAt: Date | null,
  ): Promise<void> {
    await this.destroySession(sessionId);

    const tenantId = await this.resolveTenantId();
    const descriptor = extractOidcSessionDescriptor(payload);
    if (!tenantId || !descriptor) return;

    const ttlSec = expiresAt
      ? Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / 1000))
      : undefined;
    const multi = this.redis.multi();

    for (const authorization of descriptor.authorizations) {
      const entry: RedisSessionIndexEntry = {
        sessionId,
        tenantId,
        clientId: authorization.clientId,
        accountId: descriptor.accountId,
        grantId: authorization.grantId,
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt?.toISOString() ?? null,
      };
      const lookupKey = redisLookupKey(
        tenantId,
        authorization.clientId,
        descriptor.accountId,
      );
      multi.sadd(lookupKey, sessionId);
      multi.sadd(redisSessionLookupListKey(sessionId), lookupKey);
      multi.set(redisSessionEntryKey(sessionId), JSON.stringify(entry));
      if (ttlSec) {
        multi.expire(lookupKey, ttlSec);
        multi.expire(redisSessionLookupListKey(sessionId), ttlSec);
        multi.expire(redisSessionEntryKey(sessionId), ttlSec);
      }
    }

    await multi.exec();
  }

  async destroySession(sessionId: string): Promise<void> {
    const lookupKeys = await this.redis.smembers(
      redisSessionLookupListKey(sessionId),
    );
    const multi = this.redis.multi();
    for (const lookupKey of lookupKeys) {
      multi.srem(lookupKey, sessionId);
    }
    multi.del(redisSessionLookupListKey(sessionId));
    multi.del(redisSessionEntryKey(sessionId));
    await multi.exec();
  }

  async deleteByGrantIds(grantIds: string[]): Promise<void> {
    void grantIds;
  }

  private resolveTenantId(): Promise<string | null> {
    this.tenantIdPromise ??= this.tenantRepository
      .findByCode(this.tenantCode)
      .then((tenant) => tenant?.id ?? null)
      .catch(() => null);
    return this.tenantIdPromise;
  }
}

export function redisLookupKey(
  tenantId: string,
  clientId: string,
  accountId: string,
): string {
  return `oidc:session-index:${tenantId}:${clientId}:${accountId}`;
}

export function redisSessionEntryKey(sessionId: string): string {
  return `oidc:session-index:session:${sessionId}`;
}

function redisSessionLookupListKey(sessionId: string): string {
  return `oidc:session-index:session-lookups:${sessionId}`;
}
