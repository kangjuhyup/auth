import { Migration20260910000000 as PostgreSqlMigration } from '@infrastructure/mikro-orm/migrations/postgresql/Migration20260910000000';
import { Migration20260910000000 as MySqlMigration } from '@infrastructure/mikro-orm/migrations/mysql/Migration20260910000000';
import { Migration20260910000000 as MsSqlMigration } from '@infrastructure/mikro-orm/migrations/mssql/Migration20260910000000';

describe.each([
  ['postgresql', PostgreSqlMigration],
  ['mysql', MySqlMigration],
  ['mssql', MsSqlMigration],
])('user provisioning migration: %s', (_driver, MigrationClass) => {
  it('pending 상태를 비활성화하고 Account binding을 provisioning binding으로 교체한다', async () => {
    const migration = Object.create(MigrationClass.prototype) as InstanceType<
      typeof MigrationClass
    > & { addSql: jest.Mock };
    migration.addSql = jest.fn();

    await migration.up();

    const sql = migration.addSql.mock.calls.flat().join('\n');
    expect(sql).toContain('PENDING_REGISTRATION');
    expect(sql).toContain('DISABLED');
    expect(sql).toContain('provisioned_by_client_id');
    expect(sql).toContain('provisioning_key_hash');
    expect(sql).toContain('uk_user_tenant_provisioning_key');
  });
});
