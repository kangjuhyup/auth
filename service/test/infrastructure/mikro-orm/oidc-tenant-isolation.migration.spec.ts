import { Migration20260831000000 as PostgreSqlMigration } from '@infrastructure/mikro-orm/migrations/postgresql/Migration20260831000000';
import { Migration20260831000000 as MySqlMigration } from '@infrastructure/mikro-orm/migrations/mysql/Migration20260831000000';
import { Migration20260831000000 as MsSqlMigration } from '@infrastructure/mikro-orm/migrations/mssql/Migration20260831000000';

describe.each([
  ['postgresql', PostgreSqlMigration],
  ['mysql', MySqlMigration],
  ['mssql', MsSqlMigration],
])('OIDC tenant isolation migration: %s', (_driver, MigrationClass) => {
  it('transient state를 비운 뒤 tenant composite key를 생성한다', async () => {
    const migration = Object.create(MigrationClass.prototype) as InstanceType<
      typeof MigrationClass
    > & { addSql: jest.Mock };
    migration.addSql = jest.fn();

    await migration.up();

    const sql = migration.addSql.mock.calls
      .map((call: unknown[]) => String(call[0]))
      .join('\n')
      .toLowerCase();
    expect(sql).toContain('delete from');
    expect(sql).toContain('oidc_session_index');
    expect(sql).toContain('oidc_model');
    expect(sql).toContain('tenant_id');
    expect(sql).toMatch(
      /primary key[^;]*(tenant_id[^;]*kind[^;]*id|tenant_id[^;]*session_id[^;]*client_id)/s,
    );
    expect(sql).toContain('idx_oidc_model_tenant_kind_grant');
  });
});
