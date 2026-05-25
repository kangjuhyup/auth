import { Migration } from '@mikro-orm/migrations';

export class Migration20260525010000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      IF OBJECT_ID('[custom_grant]', 'U') IS NULL
      BEGIN
        CREATE TABLE [custom_grant] (
          [id] BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
          [tenant_id] BIGINT NOT NULL,
          [grant_type] NVARCHAR(192) NOT NULL,
          [display_name] NVARCHAR(128) NOT NULL,
          [description] NVARCHAR(512) NULL,
          [enabled] BIT NOT NULL CONSTRAINT df_custom_grant_enabled DEFAULT 1,
          [allowed_client_types] NVARCHAR(MAX) NOT NULL CONSTRAINT df_custom_grant_allowed_client_types DEFAULT '[]',
          [allowed_application_types] NVARCHAR(MAX) NOT NULL CONSTRAINT df_custom_grant_allowed_application_types DEFAULT '[]',
          [requires_client_authentication] BIT NOT NULL CONSTRAINT df_custom_grant_requires_client_authentication DEFAULT 1,
          [requires_grant_types] NVARCHAR(MAX) NOT NULL CONSTRAINT df_custom_grant_requires_grant_types DEFAULT '[]',
          [built_in] BIT NOT NULL CONSTRAINT df_custom_grant_built_in DEFAULT 0,
          [created_at] DATETIME2 NOT NULL CONSTRAINT df_custom_grant_created_at DEFAULT SYSUTCDATETIME(),
          [updated_at] DATETIME2 NOT NULL CONSTRAINT df_custom_grant_updated_at DEFAULT SYSUTCDATETIME(),
          CONSTRAINT [uk_custom_grant_tenant_grant_type] UNIQUE ([tenant_id], [grant_type]),
          CONSTRAINT [fk_custom_grant_tenant] FOREIGN KEY ([tenant_id]) REFERENCES [tenant]([id]) ON DELETE CASCADE
        );
      END
    `);
    this.addSql(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_custom_grant_grant_type' AND object_id = OBJECT_ID('[custom_grant]'))
        CREATE INDEX [idx_custom_grant_grant_type] ON [custom_grant] ([grant_type]);
    `);
  }

  async down(): Promise<void> {
    this.addSql(`
      IF OBJECT_ID('[custom_grant]', 'U') IS NOT NULL
      BEGIN
        DROP TABLE [custom_grant];
      END
    `);
  }
}
