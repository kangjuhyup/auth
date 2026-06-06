import { Migration } from '@mikro-orm/migrations';

export class Migration20260524020000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      IF COL_LENGTH('dbo.client_auth_policy', 'allowed_idp_provider_keys') IS NULL
      BEGIN
        ALTER TABLE [client_auth_policy]
        ADD [allowed_idp_provider_keys] NVARCHAR(MAX) NULL;
      END
    `);

    this.addSql(`
      IF COL_LENGTH('dbo.client_auth_policy', 'reauthentication_interval_sec') IS NULL
      BEGIN
        ALTER TABLE [client_auth_policy]
        ADD [reauthentication_interval_sec] INT NULL;
      END
    `);
  }

  async down(): Promise<void> {
    this.addSql(`
      IF COL_LENGTH('dbo.client_auth_policy', 'reauthentication_interval_sec') IS NOT NULL
      BEGIN
        ALTER TABLE [client_auth_policy] DROP COLUMN [reauthentication_interval_sec];
      END
    `);

    this.addSql(`
      IF COL_LENGTH('dbo.client_auth_policy', 'allowed_idp_provider_keys') IS NOT NULL
      BEGIN
        ALTER TABLE [client_auth_policy] DROP COLUMN [allowed_idp_provider_keys];
      END
    `);
  }
}
