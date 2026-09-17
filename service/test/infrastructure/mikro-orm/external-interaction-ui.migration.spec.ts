import { Migration20260911000000 as PostgreSqlMigration } from '@infrastructure/mikro-orm/migrations/postgresql/Migration20260911000000';
import { Migration20260911000000 as MySqlMigration } from '@infrastructure/mikro-orm/migrations/mysql/Migration20260911000000';
import { Migration20260911000000 as MsSqlMigration } from '@infrastructure/mikro-orm/migrations/mssql/Migration20260911000000';

describe.each([
  ['postgresql', PostgreSqlMigration],
  ['mysql', MySqlMigration],
  ['mssql', MsSqlMigration],
])('external interaction UI migration: %s', (_driver, MigrationClass) => {
  it('client에 nullable external interaction UI URL을 추가한다', async () => {
    const migration = Object.create(MigrationClass.prototype) as InstanceType<
      typeof MigrationClass
    > & { addSql: jest.Mock };
    migration.addSql = jest.fn();

    await migration.up();

    const sql = migration.addSql.mock.calls.flat().join('\n');
    expect(sql).toContain('external_interaction_ui_url');
    expect(sql.toLowerCase()).toContain('varchar(2048)');
    expect(sql.toLowerCase()).toContain('null');
  });
});
