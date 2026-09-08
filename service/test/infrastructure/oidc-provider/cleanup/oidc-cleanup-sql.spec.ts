import {
  MikroORM,
  EntityManager,
  type Constructor,
  type IDatabaseDriver,
} from '@mikro-orm/core';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { MySqlDriver } from '@mikro-orm/mysql';
import { MsSqlDriver } from '@mikro-orm/mssql';
import { OidcModelOrmEntity } from '@infrastructure/mikro-orm/entities/oidc-model';
import { OidcSessionIndexOrmEntity } from '@infrastructure/mikro-orm/entities/oidc-session-index';
import { OidcCleanupStore } from '@infrastructure/oidc-provider/cleanup/oidc-cleanup.store';
jest.mock('mysql2', () => ({}), { virtual: true });
jest.mock('tedious', () => ({}), { virtual: true });
const drivers: Array<[string, Constructor<IDatabaseDriver>]> = [
  ['postgresql', PostgreSqlDriver],
  ['mysql', MySqlDriver],
  ['mssql', MsSqlDriver],
];
describe.each(drivers)('OIDC cleanup lock SQL (%s)', (name, driver) => {
  it('compiles a bounded update-lock selection without fetching payloads', async () => {
    const orm = await MikroORM.init({
      driver,
      dbName: 'cleanup_sql_test',
      entities: [OidcModelOrmEntity, OidcSessionIndexOrmEntity],
      connect: false,
    });
    const tx = orm.em.fork();
    const connection = tx.getConnection() as unknown as {
      getKnex(): { client: object };
    };
    const client = Object.create(connection.getKnex().client) as {
      transacting: boolean;
    };
    client.transacting = true;
    tx.setTransactionContext({ client });
    const em = {
      fork: () => ({
        transactional: (fn: (em: EntityManager) => Promise<unknown>) => fn(tx),
      }),
    };
    const execute = jest
      .spyOn(tx.getConnection(), 'execute')
      .mockResolvedValue([]);
    try {
      await new OidcCleanupStore(em as unknown as EntityManager).cleanupBatch(
        new Date('2026-01-01'),
        500,
      );
      const select = execute.mock.calls.find(([sql]) =>
        /^select /i.test(String(sql)),
      );
      expect(select).toBeDefined();
      expect(String(select![0])).toMatch(
        name === 'mssql' ? /updlock/i : /for update/i,
      );
      expect(String(select![0])).not.toMatch(/payload/);
      expect(String(select![0])).toMatch(
        name === 'mssql' ? /top|fetch next/i : /limit/i,
      );
    } finally {
      execute.mockRestore();
      await orm.close(true);
    }
  });
});
