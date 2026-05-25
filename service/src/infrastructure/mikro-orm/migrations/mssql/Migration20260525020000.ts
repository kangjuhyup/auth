import { Migration } from '@mikro-orm/migrations';

export class Migration20260525020000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      IF COL_LENGTH('dbo.client_auth_policy', 'login_session_mode') IS NULL
        ALTER TABLE [client_auth_policy]
        ADD [login_session_mode] NVARCHAR(16) NULL;
    `);
    this.addSql(`
      IF COL_LENGTH('dbo.client_auth_policy', 'max_concurrent_sessions') IS NULL
        ALTER TABLE [client_auth_policy]
        ADD [max_concurrent_sessions] INT NULL;
    `);
    this.addSql(`
      IF COL_LENGTH('dbo.client_auth_policy', 'session_conflict_action') IS NULL
        ALTER TABLE [client_auth_policy]
        ADD [session_conflict_action] NVARCHAR(32) NULL;
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`
      IF COL_LENGTH('dbo.client_auth_policy', 'session_conflict_action') IS NOT NULL
        ALTER TABLE [client_auth_policy] DROP COLUMN [session_conflict_action];
    `);
    this.addSql(`
      IF COL_LENGTH('dbo.client_auth_policy', 'max_concurrent_sessions') IS NOT NULL
        ALTER TABLE [client_auth_policy] DROP COLUMN [max_concurrent_sessions];
    `);
    this.addSql(`
      IF COL_LENGTH('dbo.client_auth_policy', 'login_session_mode') IS NOT NULL
        ALTER TABLE [client_auth_policy] DROP COLUMN [login_session_mode];
    `);
  }
}
