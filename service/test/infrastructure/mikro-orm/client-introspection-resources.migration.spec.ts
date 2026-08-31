import { Migration20260831010000 as PostgreSqlMigration } from '@infrastructure/mikro-orm/migrations/postgresql/Migration20260831010000';
import { Migration20260831010000 as MySqlMigration } from '@infrastructure/mikro-orm/migrations/mysql/Migration20260831010000';
import { Migration20260831010000 as MsSqlMigration } from '@infrastructure/mikro-orm/migrations/mssql/Migration20260831010000';

describe.each([
  {
    driver: 'postgresql',
    MigrationClass: PostgreSqlMigration,
    upSql: [
      `ALTER TABLE "client" ADD COLUMN "introspection_resources" JSON NOT NULL DEFAULT '[]';`,
    ],
    downSql: [
      `ALTER TABLE "client" DROP COLUMN "introspection_resources";`,
    ],
  },
  {
    driver: 'mysql',
    MigrationClass: MySqlMigration,
    upSql: [
      'ALTER TABLE `client` ADD COLUMN `introspection_resources` JSON NULL;',
      'UPDATE `client` SET `introspection_resources` = JSON_ARRAY() WHERE `introspection_resources` IS NULL;',
      'ALTER TABLE `client` MODIFY COLUMN `introspection_resources` JSON NOT NULL;',
    ],
    downSql: [
      'ALTER TABLE `client` DROP COLUMN `introspection_resources`;',
    ],
  },
  {
    driver: 'mssql',
    MigrationClass: MsSqlMigration,
    upSql: [
      "ALTER TABLE [client] ADD [introspection_resources] NVARCHAR(MAX) NOT NULL CONSTRAINT [df_client_introspection_resources] DEFAULT '[]';",
    ],
    downSql: [
      'ALTER TABLE [client] DROP CONSTRAINT [df_client_introspection_resources];',
      'ALTER TABLE [client] DROP COLUMN [introspection_resources];',
    ],
  },
])(
  'client introspection resources migration: $driver',
  ({ MigrationClass, upSql, downSql }) => {
    it('기존 client를 빈 allowlist로 backfill하고 non-null column을 만든다', async () => {
      const migration = Object.create(MigrationClass.prototype) as InstanceType<
        typeof MigrationClass
      > & { addSql: jest.Mock };
      migration.addSql = jest.fn();

      await migration.up();

      expect(migration.addSql.mock.calls).toEqual(upSql.map((sql) => [sql]));
    });

    it('down은 새 column만 제거한다', async () => {
      const migration = Object.create(MigrationClass.prototype) as InstanceType<
        typeof MigrationClass
      > & { addSql: jest.Mock };
      migration.addSql = jest.fn();

      await migration.down();

      expect(migration.addSql.mock.calls).toEqual(downSql.map((sql) => [sql]));
    });
  },
);
