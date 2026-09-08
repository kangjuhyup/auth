import { EntityManager, LockMode } from '@mikro-orm/core';
import { OidcModelOrmEntity } from '@infrastructure/mikro-orm/entities/oidc-model';
import { OidcSessionIndexOrmEntity } from '@infrastructure/mikro-orm/entities/oidc-session-index';

const CLEANUP_KINDS = [
  'AccessToken',
  'AuthorizationCode',
  'Interaction',
  'Session',
  'Grant',
  'RefreshToken',
];

/** Infrastructure maintenance only. Security/reuse markers never enter this allowlist. */
export class OidcCleanupStore {
  constructor(private readonly em: EntityManager) {}

  async cleanupBatch(
    cutoff: Date,
    batchSize = 500,
  ): Promise<{ deletedModels: number; deletedSessionIndexes: number }> {
    if (!Number.isFinite(cutoff.getTime())) {
      throw new RangeError('Cleanup cutoff must be a valid date');
    }
    if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1000) {
      throw new RangeError('Cleanup batch size must be between 1 and 1000');
    }
    return this.em.fork().transactional(async (tx) => {
      // PostgreSQL transaction-local settings do not leak through pooled connections.
      // Other drivers use their configured database lock/statement timeouts.
      if (
        tx.getPlatform().getConfig().get('driver')?.name === 'PostgreSqlDriver'
      ) {
        await tx
          .getConnection()
          .execute(
            "set local lock_timeout = '1000ms'",
            [],
            'run',
            tx.getTransactionContext(),
          );
        await tx
          .getConnection()
          .execute(
            "set local statement_timeout = '5000ms'",
            [],
            'run',
            tx.getTransactionContext(),
          );
      }
      const rows = await tx.find(
        OidcModelOrmEntity,
        { kind: { $in: CLEANUP_KINDS }, expiresAt: { $lt: cutoff } },
        {
          fields: ['tenantId', 'kind', 'id'],
          orderBy: {
            expiresAt: 'asc',
            tenantId: 'asc',
            kind: 'asc',
            id: 'asc',
          },
          limit: batchSize,
          // Portable FOR UPDATE / MSSQL UPDLOCK. Hold until index cleanup commits.
          lockMode: LockMode.PESSIMISTIC_WRITE,
        },
      );
      const groups = new Map<
        string,
        { tenantId: string; kind: string; ids: string[] }
      >();
      for (const row of rows) {
        const key = JSON.stringify([row.tenantId, row.kind]);
        const group = groups.get(key) ?? {
          tenantId: row.tenantId,
          kind: row.kind,
          ids: [],
        };
        group.ids.push(row.id);
        groups.set(key, group);
      }
      let deletedModels = 0;
      let deletedSessionIndexes = 0;
      for (const group of groups.values()) {
        const deleted = await tx.nativeDelete(OidcModelOrmEntity, {
          tenantId: group.tenantId,
          kind: group.kind,
          id: { $in: group.ids },
          expiresAt: { $lt: cutoff },
        });
        deletedModels += deleted;
        if (group.kind === 'Session') {
          // Never delete indexes for a parent that survived the expiry recheck.
          // Under the row locks this mismatch is unexpected: fail and roll back.
          if (deleted !== group.ids.length) {
            throw new Error('Session cleanup eligibility changed under lock');
          }
          deletedSessionIndexes += await tx.nativeDelete(
            OidcSessionIndexOrmEntity,
            {
              tenantId: group.tenantId,
              sessionId: { $in: group.ids },
            },
          );
        }
      }
      return { deletedModels, deletedSessionIndexes };
    });
  }
}
