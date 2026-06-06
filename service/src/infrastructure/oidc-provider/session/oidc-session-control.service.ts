import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EntityManager } from '@mikro-orm/core';
import Redis from 'ioredis';
import { REDIS } from '@infrastructure/redis/redis.module';
import { OidcModelOrmEntity } from '@infrastructure/mikro-orm/entities/oidc-model';
import { OidcSessionIndexOrmEntity } from '@infrastructure/mikro-orm/entities/oidc-session-index';
import { UserSessionPort } from '@application/ports/user-session.port';
import type { UserSessionView } from '@application/ports/user-session.port';
import { RedisAdapter } from '../adapters/redis-oidc.adapter';
import {
  redisLookupKey,
  redisSessionEntryKey,
  redisUserLookupKey,
  type OidcSessionRecord,
} from './oidc-session-index.store';

const GRANT_BOUND_KINDS = [
  'AccessToken',
  'AuthorizationCode',
  'RefreshToken',
  'DeviceCode',
  'BackchannelAuthenticationRequest',
  'ClientCredentials',
];

@Injectable()
export class OidcSessionControlService extends UserSessionPort {
  constructor(
    private readonly em: EntityManager,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async listUserSessions(params: {
    tenantId: string;
    userId: string;
  }): Promise<UserSessionView[]> {
    const sessions = this.usesRedisOnly()
      ? await this.listRedisUserSessions(params)
      : await this.listRdbUserSessions(params);

    return sessions.map((session) => ({
      sessionId: session.sessionId,
      tenantId: session.tenantId,
      userId: session.accountId,
      clientId: session.clientId,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    }));
  }

  async revokeUserSession(params: {
    tenantId: string;
    userId: string;
    sessionId: string;
  }): Promise<number> {
    const sessions = await this.getUserSessionRecords({
      tenantId: params.tenantId,
      userId: params.userId,
      sessionId: params.sessionId,
    });
    await this.revokeSessions(sessions);
    return sessions.length;
  }

  async revokeUserSessions(params: {
    tenantId: string;
    userId: string;
  }): Promise<number> {
    const sessions = this.usesRedisOnly()
      ? await this.listRedisUserSessions(params)
      : await this.listRdbUserSessions(params);
    await this.revokeSessions(sessions);
    return sessions.length;
  }

  async listActiveSessions(params: {
    tenantId: string;
    clientId: string;
    accountId: string;
  }): Promise<OidcSessionRecord[]> {
    if (this.usesRedisOnly()) {
      return this.listRedisSessions(params);
    }

    const now = new Date();
    const em = this.em.fork();
    const rows = await em.find(
      OidcSessionIndexOrmEntity,
      {
        tenantId: params.tenantId,
        clientId: params.clientId,
        accountId: params.accountId,
        $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
      } as any,
      { orderBy: { createdAt: 'ASC' } as any },
    );

    return rows.map(toSessionRecord);
  }

  async revokeSessions(sessions: readonly OidcSessionRecord[]): Promise<void> {
    if (sessions.length === 0) return;

    const sessionIds = [
      ...new Set(sessions.map((session) => session.sessionId)),
    ];
    const grantIds = [
      ...new Set(
        sessions
          .map((session) => session.grantId)
          .filter((grantId): grantId is string => !!grantId),
      ),
    ];

    await this.revokeRedis(sessionIds, grantIds);
    if (!this.usesRedisOnly()) {
      await this.revokeRdb(sessionIds, grantIds);
    }
  }

  private async revokeRdb(
    sessionIds: string[],
    grantIds: string[],
  ): Promise<void> {
    const em = this.em.fork();
    await em.nativeDelete(OidcModelOrmEntity, {
      kind: 'Session',
      id: { $in: sessionIds },
    } as any);
    await em.nativeDelete(OidcSessionIndexOrmEntity, {
      sessionId: { $in: sessionIds },
    } as any);

    if (grantIds.length === 0) return;

    await em.nativeDelete(OidcModelOrmEntity, {
      grantId: { $in: grantIds },
    } as any);
    await em.nativeDelete(OidcModelOrmEntity, {
      kind: 'Grant',
      id: { $in: grantIds },
    } as any);
    await em.nativeDelete(OidcSessionIndexOrmEntity, {
      grantId: { $in: grantIds },
    } as any);
  }

  private async revokeRedis(
    sessionIds: string[],
    grantIds: string[],
  ): Promise<void> {
    const sessionAdapter = new RedisAdapter('Session', this.redis);
    await Promise.all(
      sessionIds.map((sessionId) => sessionAdapter.destroy(sessionId)),
    );

    for (const grantId of grantIds) {
      for (const kind of GRANT_BOUND_KINDS) {
        await new RedisAdapter(kind, this.redis).revokeByGrantId(grantId);
      }
      await new RedisAdapter('Grant', this.redis).destroy(grantId);
    }
  }

  private async listRdbUserSessions(params: {
    tenantId: string;
    userId: string;
  }): Promise<OidcSessionRecord[]> {
    const now = new Date();
    const em = this.em.fork();
    const rows = await em.find(
      OidcSessionIndexOrmEntity,
      {
        tenantId: params.tenantId,
        accountId: params.userId,
        $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
      } as any,
      { orderBy: { createdAt: 'DESC' } as any },
    );

    return rows.map(toSessionRecord);
  }

  private async getUserSessionRecords(params: {
    tenantId: string;
    userId: string;
    sessionId: string;
  }): Promise<OidcSessionRecord[]> {
    if (this.usesRedisOnly()) {
      const sessions = await this.listRedisUserSessions({
        tenantId: params.tenantId,
        userId: params.userId,
      });
      return sessions.filter(
        (session) => session.sessionId === params.sessionId,
      );
    }

    const now = new Date();
    const em = this.em.fork();
    const rows = await em.find(
      OidcSessionIndexOrmEntity,
      {
        tenantId: params.tenantId,
        accountId: params.userId,
        sessionId: params.sessionId,
        $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
      } as any,
      { orderBy: { createdAt: 'ASC' } as any },
    );

    return rows.map(toSessionRecord);
  }

  private async listRedisSessions(params: {
    tenantId: string;
    clientId: string;
    accountId: string;
  }): Promise<OidcSessionRecord[]> {
    const sessionIds = await this.redis.smembers(
      redisLookupKey(params.tenantId, params.clientId, params.accountId),
    );
    return this.readRedisSessions(sessionIds, 'ASC');
  }

  private async listRedisUserSessions(params: {
    tenantId: string;
    userId: string;
  }): Promise<OidcSessionRecord[]> {
    const sessionIds = await this.redis.smembers(
      redisUserLookupKey(params.tenantId, params.userId),
    );
    return this.readRedisSessions(sessionIds, 'DESC');
  }

  private async readRedisSessions(
    sessionIds: string[],
    direction: 'ASC' | 'DESC',
  ): Promise<OidcSessionRecord[]> {
    const now = Date.now();
    const sessions: OidcSessionRecord[] = [];

    for (const sessionId of sessionIds) {
      const raw = await this.redis.get(redisSessionEntryKey(sessionId));
      if (!raw) continue;
      const parsed = safeJsonParse(raw);
      if (!parsed) continue;

      const expiresAt = parsed.expiresAt ? new Date(parsed.expiresAt) : null;
      if (expiresAt && expiresAt.getTime() <= now) continue;

      sessions.push({
        sessionId: parsed.sessionId,
        tenantId: parsed.tenantId,
        clientId: parsed.clientId,
        accountId: parsed.accountId,
        grantId: parsed.grantId,
        createdAt: new Date(parsed.createdAt),
        expiresAt,
      });
    }

    return sessions.sort((left, right) => {
      const diff = left.createdAt.getTime() - right.createdAt.getTime();
      return direction === 'ASC' ? diff : -diff;
    });
  }

  private usesRedisOnly(): boolean {
    return this.config.get<string>('OIDC_ADAPTER_DRIVER') === 'redis';
  }
}

function toSessionRecord(row: OidcSessionIndexOrmEntity): OidcSessionRecord {
  return {
    sessionId: row.sessionId,
    tenantId: row.tenantId,
    clientId: row.clientId,
    accountId: row.accountId,
    grantId: row.grantId ?? null,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt ?? null,
  };
}

function safeJsonParse(raw: string): OidcSessionRecordJson | null {
  try {
    const parsed = JSON.parse(raw) as Partial<OidcSessionRecordJson>;
    if (
      typeof parsed.sessionId !== 'string' ||
      typeof parsed.tenantId !== 'string' ||
      typeof parsed.clientId !== 'string' ||
      typeof parsed.accountId !== 'string' ||
      typeof parsed.createdAt !== 'string'
    ) {
      return null;
    }

    return {
      sessionId: parsed.sessionId,
      tenantId: parsed.tenantId,
      clientId: parsed.clientId,
      accountId: parsed.accountId,
      grantId: typeof parsed.grantId === 'string' ? parsed.grantId : null,
      createdAt: parsed.createdAt,
      expiresAt: typeof parsed.expiresAt === 'string' ? parsed.expiresAt : null,
    };
  } catch {
    return null;
  }
}

type OidcSessionRecordJson = {
  sessionId: string;
  tenantId: string;
  clientId: string;
  accountId: string;
  grantId: string | null;
  createdAt: string;
  expiresAt: string | null;
};
