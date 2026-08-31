import type { EntityManager } from '@mikro-orm/core';
import type { AdapterPayload } from 'oidc-provider';
import type { Redis } from 'ioredis';
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
  constructor(
    private readonly em: EntityManager,
    private readonly tenantId: string,
  ) {}

  async upsertSession(
    sessionId: string,
    payload: AdapterPayload,
    expiresAt: Date | null,
  ): Promise<void> {
    const descriptor = extractOidcSessionDescriptor(payload);
    const em = this.em.fork();

    await em.nativeDelete(OidcSessionIndexOrmEntity, {
      tenantId: this.tenantId,
      sessionId,
    });
    if (!descriptor) {
      await em.flush();
      return;
    }

    for (const authorization of descriptor.authorizations) {
      em.create(OidcSessionIndexOrmEntity, {
        sessionId,
        tenantId: this.tenantId,
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
    await em.nativeDelete(OidcSessionIndexOrmEntity, {
      tenantId: this.tenantId,
      sessionId,
    });
  }

  async deleteByGrantIds(grantIds: string[]): Promise<void> {
    if (grantIds.length === 0) return;
    const em = this.em.fork();
    await em.nativeDelete(OidcSessionIndexOrmEntity, {
      tenantId: this.tenantId,
      grantId: { $in: grantIds },
    } as any);
  }
}

type RedisSessionIndexEntry = {
  sessionId: string;
  tenantId: string;
  accountId: string;
  authorizations: Array<{
    clientId: string;
    grantId: string | null;
  }>;
  createdAt: string;
  expiresAt: string | null;
};

export class RedisOidcSessionIndexStore implements OidcSessionIndexStore {
  constructor(
    private readonly redis: Redis,
    private readonly tenantId: string,
  ) {}

  async upsertSession(
    sessionId: string,
    payload: AdapterPayload,
    expiresAt: Date | null,
  ): Promise<void> {
    await this.destroySession(sessionId);

    const descriptor = extractOidcSessionDescriptor(payload);
    if (!descriptor) return;

    const ttlSec = expiresAt
      ? Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / 1000))
      : undefined;
    const multi = this.redis.multi();
    const userLookupKey = redisUserLookupKey(
      this.tenantId,
      descriptor.accountId,
    );
    const reverseLookupKey = redisSessionLookupListKey(
      this.tenantId,
      sessionId,
    );
    const entryKey = redisSessionEntryKey(this.tenantId, sessionId);
    const entry: RedisSessionIndexEntry = {
      sessionId,
      tenantId: this.tenantId,
      accountId: descriptor.accountId,
      authorizations: descriptor.authorizations.map((authorization) => ({
        clientId: authorization.clientId,
        grantId: authorization.grantId,
      })),
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt?.toISOString() ?? null,
    };

    multi.sadd(userLookupKey, sessionId);
    multi.sadd(reverseLookupKey, userLookupKey);
    multi.set(entryKey, JSON.stringify(entry));

    for (const authorization of descriptor.authorizations) {
      const lookupKey = redisLookupKey(
        this.tenantId,
        authorization.clientId,
        descriptor.accountId,
      );
      multi.sadd(lookupKey, sessionId);
      multi.sadd(reverseLookupKey, lookupKey);
      if (ttlSec) {
        multi.expire(lookupKey, ttlSec);
      }
    }
    if (ttlSec) {
      multi.expire(userLookupKey, ttlSec);
      multi.expire(reverseLookupKey, ttlSec);
      multi.expire(entryKey, ttlSec);
    }

    await multi.exec();
  }

  async destroySession(sessionId: string): Promise<void> {
    const lookupKeys = await this.redis.smembers(
      redisSessionLookupListKey(this.tenantId, sessionId),
    );
    const multi = this.redis.multi();
    for (const lookupKey of lookupKeys) {
      multi.srem(lookupKey, sessionId);
    }
    multi.del(redisSessionLookupListKey(this.tenantId, sessionId));
    multi.del(redisSessionEntryKey(this.tenantId, sessionId));
    await multi.exec();
  }

  async deleteByGrantIds(grantIds: string[]): Promise<void> {
    void grantIds;
  }
}

export function redisLookupKey(
  tenantId: string,
  clientId: string,
  accountId: string,
): string {
  return `oidc:session-index:${tenantId}:${clientId}:${accountId}`;
}

export function redisUserLookupKey(
  tenantId: string,
  accountId: string,
): string {
  return `oidc:session-index:${tenantId}:user:${accountId}`;
}

export function redisSessionEntryKey(
  tenantId: string,
  sessionId: string,
): string {
  return `oidc:session-index:${tenantId}:session:${sessionId}`;
}

function redisSessionLookupListKey(
  tenantId: string,
  sessionId: string,
): string {
  return `oidc:session-index:${tenantId}:session-lookups:${sessionId}`;
}
