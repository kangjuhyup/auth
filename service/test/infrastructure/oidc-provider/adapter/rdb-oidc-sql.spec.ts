import {
  MikroORM,
  type Constructor,
  type IDatabaseDriver,
} from '@mikro-orm/core';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { MySqlDriver } from '@mikro-orm/mysql';
import { MsSqlDriver } from '@mikro-orm/mssql';
import { OidcModelOrmEntity } from '@infrastructure/mikro-orm/entities/oidc-model';
import { RdbOidcAdapter } from '@infrastructure/oidc-provider/adapters/rdb-oidc.adapter';

// Only SQL compilation is exercised here; no native database connections.
jest.mock('mysql2', () => ({}), { virtual: true });
jest.mock('tedious', () => ({}), { virtual: true });

const drivers: Array<[string, Constructor<IDatabaseDriver>]> = [
  ['postgresql', PostgreSqlDriver],
  ['mysql', MySqlDriver],
  ['mssql', MsSqlDriver],
];

describe.each(drivers)('RDB OIDC SQL compilation (%s)', (_name, driver) => {
  it('binds tenant values and emits one tenant-scoped conflict subquery', async () => {
    const orm = await MikroORM.init({
      driver,
      dbName: 'oidc_sql_test',
      entities: [OidcModelOrmEntity],
      connect: false,
    });
    const execute = jest
      .spyOn(orm.em.getConnection(), 'execute')
      .mockResolvedValue([]);
    try {
      const tenant = "tenant-'a";
      await expect(
        new RdbOidcAdapter(tenant, 'AccessToken', orm.em).find('token-1'),
      ).resolves.toBeUndefined();
      expect(execute).toHaveBeenCalledTimes(1);
      const [query, parameters] = execute.mock.calls[0];
      expect(String(query)).toMatch(/not exists \(select 1 from/i);
      expect(String(query)).not.toContain(tenant);
      expect(parameters).toEqual(
        expect.arrayContaining([tenant, 'RefreshTokenReuseGrantConflict']),
      );
    } finally {
      execute.mockRestore();
      await orm.close(true);
    }
  });
});
