import { Migration } from '@mikro-orm/migrations';

export class Migration20260524030000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      IF COL_LENGTH('dbo.user', 'mfa_enabled') IS NULL
      BEGIN
        ALTER TABLE [user]
        ADD [mfa_enabled] BIT NOT NULL CONSTRAINT df_user_mfa_enabled DEFAULT 0;
      END
    `);
  }

  async down(): Promise<void> {
    this.addSql(`
      IF COL_LENGTH('dbo.user', 'mfa_enabled') IS NOT NULL
      BEGIN
        DECLARE @constraintName NVARCHAR(200);
        SELECT @constraintName = dc.name
        FROM sys.default_constraints dc
        JOIN sys.columns c ON c.default_object_id = dc.object_id
        WHERE dc.parent_object_id = OBJECT_ID('dbo.user')
          AND c.name = 'mfa_enabled';
        IF @constraintName IS NOT NULL
          EXEC('ALTER TABLE [user] DROP CONSTRAINT ' + @constraintName);
        ALTER TABLE [user] DROP COLUMN [mfa_enabled];
      END
    `);
  }
}
