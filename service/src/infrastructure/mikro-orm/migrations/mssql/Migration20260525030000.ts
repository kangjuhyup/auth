import { Migration } from '@mikro-orm/migrations';

export class Migration20260525030000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      IF OBJECT_ID(N'dbo.[oidc_session_index]', N'U') IS NULL
      CREATE TABLE [oidc_session_index] (
        [session_id] NVARCHAR(128) NOT NULL,
        [tenant_id] NVARCHAR(64) NOT NULL,
        [client_id] NVARCHAR(128) NOT NULL,
        [account_id] NVARCHAR(128) NOT NULL,
        [grant_id] NVARCHAR(128) NULL,
        [expires_at] DATETIME2 NULL,
        [created_at] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [oidc_session_index_pkey] PRIMARY KEY ([session_id], [client_id])
      );
    `);
    this.addSql(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_oidc_session_idx_lookup' AND object_id = OBJECT_ID('[oidc_session_index]'))
        CREATE INDEX idx_oidc_session_idx_lookup
        ON [oidc_session_index] ([tenant_id], [client_id], [account_id], [expires_at]);
    `);
    this.addSql(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_oidc_session_idx_grant' AND object_id = OBJECT_ID('[oidc_session_index]'))
        CREATE INDEX idx_oidc_session_idx_grant
        ON [oidc_session_index] ([grant_id]);
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`
      IF OBJECT_ID(N'dbo.[oidc_session_index]', N'U') IS NOT NULL
        DROP TABLE [oidc_session_index];
    `);
  }
}
