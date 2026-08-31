import { Migration20260831010000 as PostgreSqlMigration } from '@infrastructure/mikro-orm/migrations/postgresql/Migration20260831010000';
import { Migration20260831010000 as MySqlMigration } from '@infrastructure/mikro-orm/migrations/mysql/Migration20260831010000';
import { Migration20260831010000 as MsSqlMigration } from '@infrastructure/mikro-orm/migrations/mssql/Migration20260831010000';

describe.each([
  ['postgresql', PostgreSqlMigration],
  ['mysql', MySqlMigration],
  ['mssql', MsSqlMigration],
])(
  'client introspection resources migration: %s',
  (_driver, MigrationClass) => {
    it('기존 client를 빈 allowlist로 backfill하고 non-null column을 만든다', async () => {
      const migration = Object.create(MigrationClass.prototype) as InstanceType<
        typeof MigrationClass
      > & { addSql: jest.Mock };
      migration.addSql = jest.fn();

      await migration.up();

      const sql = migration.addSql.mock.calls
        .map((call: unknown[]) => String(call[0]))
        .join('\n')
        .toLowerCase();
      expect(sql).toContain('introspection_resources');
      expect(sql).toContain('not null');
      expect(sql).toMatch(/\[\]|json_array/);
    });

    it('down은 새 column만 제거한다', async () => {
      const migration = Object.create(MigrationClass.prototype) as InstanceType<
        typeof MigrationClass
      > & { addSql: jest.Mock };
      migration.addSql = jest.fn();

      await migration.down();

      const sql = migration.addSql.mock.calls
        .map((call: unknown[]) => String(call[0]))
        .join('\n')
        .toLowerCase();
      expect(sql).toContain('drop');
      expect(sql).toContain('introspection_resources');
    });
  },
);
