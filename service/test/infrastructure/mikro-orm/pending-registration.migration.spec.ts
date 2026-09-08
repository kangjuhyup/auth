import { Migration20260908000000 as PostgreSqlMigration } from '@infrastructure/mikro-orm/migrations/postgresql/Migration20260908000000';
import { Migration20260908000000 as MySqlMigration } from '@infrastructure/mikro-orm/migrations/mysql/Migration20260908000000';
import { Migration20260908000000 as MsSqlMigration } from '@infrastructure/mikro-orm/migrations/mssql/Migration20260908000000';

describe.each([
  ['postgresql', PostgreSqlMigration],
  ['mysql', MySqlMigration],
  ['mssql', MsSqlMigration],
])('pending registration migration: %s', (_driver, MigrationClass) => {
  it('Account registration과 attempt binding을 nullable column과 unique index로 추가한다', async () => {
    const migration = Object.create(MigrationClass.prototype) as InstanceType<
      typeof MigrationClass
    > & { addSql: jest.Mock };
    migration.addSql = jest.fn();

    await migration.up();

    const sql = migration.addSql.mock.calls
      .map((call: unknown[]) => String(call[0]))
      .join('\n')
      .toLowerCase();
    expect(sql).toContain('account_registration_id');
    expect(sql).toContain('registration_attempt_id');
    expect(sql).toContain('unique index');
    expect(sql).toContain('tenant_id');
  });

  it('down은 unique index를 먼저 제거한 뒤 binding column을 제거한다', async () => {
    const migration = Object.create(MigrationClass.prototype) as InstanceType<
      typeof MigrationClass
    > & { addSql: jest.Mock };
    migration.addSql = jest.fn();

    await migration.down();

    const sql = migration.addSql.mock.calls.map((call: unknown[]) =>
      String(call[0]).toLowerCase(),
    );
    expect(sql[0]).toContain('drop index');
    expect(sql.join('\n')).toContain('account_registration_id');
    expect(sql.join('\n')).toContain('registration_attempt_id');
  });
});
