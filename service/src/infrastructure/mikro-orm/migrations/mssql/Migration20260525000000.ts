import { Migration } from '@mikro-orm/migrations';

export class Migration20260525000000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      IF OBJECT_ID('[scope]', 'U') IS NULL
      BEGIN
        CREATE TABLE [scope] (
          [id] BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
          [tenant_id] BIGINT NOT NULL,
          [name] NVARCHAR(128) NOT NULL,
          [display_name] NVARCHAR(128) NOT NULL,
          [description] NVARCHAR(512) NULL,
          [claim_keys] NVARCHAR(MAX) NOT NULL CONSTRAINT df_scope_claim_keys DEFAULT '[]',
          [enabled] BIT NOT NULL CONSTRAINT df_scope_enabled DEFAULT 1,
          [built_in] BIT NOT NULL CONSTRAINT df_scope_built_in DEFAULT 0,
          [created_at] DATETIME2 NOT NULL CONSTRAINT df_scope_created_at DEFAULT SYSUTCDATETIME(),
          [updated_at] DATETIME2 NOT NULL CONSTRAINT df_scope_updated_at DEFAULT SYSUTCDATETIME(),
          CONSTRAINT [uk_scope_tenant_name] UNIQUE ([tenant_id], [name]),
          CONSTRAINT [fk_scope_tenant] FOREIGN KEY ([tenant_id]) REFERENCES [tenant]([id]) ON DELETE CASCADE
        );
      END
    `);
    this.addSql(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_scope_name' AND object_id = OBJECT_ID('[scope]'))
        CREATE INDEX [idx_scope_name] ON [scope] ([name]);
    `);
    this.addSql(`
      INSERT INTO [scope] ([tenant_id], [name], [display_name], [description], [claim_keys], [enabled], [built_in], [created_at], [updated_at])
      SELECT t.[id], s.[name], s.[display_name], s.[description], s.[claim_keys], 1, 1, SYSUTCDATETIME(), SYSUTCDATETIME()
      FROM [tenant] t
      CROSS JOIN (
        VALUES
          ('openid', 'OpenID', 'OIDC authentication scope', '[]'),
          ('profile', 'Profile', 'Basic profile claims', '["profile"]'),
          ('email', 'Email', 'Email claims', '["email"]')
      ) s([name], [display_name], [description], [claim_keys])
      WHERE NOT EXISTS (
        SELECT 1 FROM [scope] existing
        WHERE existing.[tenant_id] = t.[id] AND existing.[name] = s.[name]
      );
    `);
  }

  async down(): Promise<void> {
    this.addSql(`
      IF OBJECT_ID('[scope]', 'U') IS NOT NULL
      BEGIN
        DROP TABLE [scope];
      END
    `);
  }
}
