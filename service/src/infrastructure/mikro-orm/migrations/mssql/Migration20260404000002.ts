import { Migration } from '@mikro-orm/migrations';

export class Migration20260404000002 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      IF COL_LENGTH('dbo.identity_provider', 'protocol') IS NULL
      BEGIN
        ALTER TABLE [identity_provider]
        ADD [protocol] NVARCHAR(16) NOT NULL CONSTRAINT df_identity_provider_protocol DEFAULT N'oauth2';
      END
    `);

    this.addSql(`
      IF COL_LENGTH('dbo.identity_provider', 'saml_config') IS NULL
      BEGIN
        ALTER TABLE [identity_provider]
        ADD [saml_config] NVARCHAR(MAX) NULL;
      END
    `);
  }

  async down(): Promise<void> {
    this.addSql(`
      IF COL_LENGTH('dbo.identity_provider', 'saml_config') IS NOT NULL
      BEGIN
        ALTER TABLE [identity_provider] DROP COLUMN [saml_config];
      END
    `);

    this.addSql(`
      IF COL_LENGTH('dbo.identity_provider', 'protocol') IS NOT NULL
      BEGIN
        DECLARE @constraintName NVARCHAR(200);
        SELECT @constraintName = dc.name
        FROM sys.default_constraints dc
        JOIN sys.columns c ON c.default_object_id = dc.object_id
        WHERE dc.parent_object_id = OBJECT_ID('dbo.identity_provider')
          AND c.name = 'protocol';

        IF @constraintName IS NOT NULL
          EXEC('ALTER TABLE [identity_provider] DROP CONSTRAINT ' + @constraintName);

        ALTER TABLE [identity_provider] DROP COLUMN [protocol];
      END
    `);
  }
}
