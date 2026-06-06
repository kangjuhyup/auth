import { Migration } from '@mikro-orm/migrations';

export class Migration20260524000000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      IF COL_LENGTH('dbo.client_auth_policy', 'refresh_token_rotation_enabled') IS NULL
      BEGIN
        ALTER TABLE [client_auth_policy]
        ADD [refresh_token_rotation_enabled] BIT NOT NULL CONSTRAINT df_client_auth_policy_refresh_token_rotation_enabled DEFAULT 1;
      END
    `);

    this.addSql(`
      IF COL_LENGTH('dbo.client_auth_policy', 'refresh_token_reuse_action') IS NULL
      BEGIN
        ALTER TABLE [client_auth_policy]
        ADD [refresh_token_reuse_action] NVARCHAR(32) NOT NULL CONSTRAINT df_client_auth_policy_refresh_token_reuse_action DEFAULT N'revoke_grant';
      END
    `);
  }

  async down(): Promise<void> {
    this.addSql(`
      IF COL_LENGTH('dbo.client_auth_policy', 'refresh_token_reuse_action') IS NOT NULL
      BEGIN
        DECLARE @reuseActionConstraintName NVARCHAR(200);
        SELECT @reuseActionConstraintName = dc.name
        FROM sys.default_constraints dc
        JOIN sys.columns c ON c.default_object_id = dc.object_id
        WHERE dc.parent_object_id = OBJECT_ID('dbo.client_auth_policy')
          AND c.name = 'refresh_token_reuse_action';

        IF @reuseActionConstraintName IS NOT NULL
          EXEC('ALTER TABLE [client_auth_policy] DROP CONSTRAINT ' + @reuseActionConstraintName);

        ALTER TABLE [client_auth_policy] DROP COLUMN [refresh_token_reuse_action];
      END
    `);

    this.addSql(`
      IF COL_LENGTH('dbo.client_auth_policy', 'refresh_token_rotation_enabled') IS NOT NULL
      BEGIN
        DECLARE @rotationConstraintName NVARCHAR(200);
        SELECT @rotationConstraintName = dc.name
        FROM sys.default_constraints dc
        JOIN sys.columns c ON c.default_object_id = dc.object_id
        WHERE dc.parent_object_id = OBJECT_ID('dbo.client_auth_policy')
          AND c.name = 'refresh_token_rotation_enabled';

        IF @rotationConstraintName IS NOT NULL
          EXEC('ALTER TABLE [client_auth_policy] DROP CONSTRAINT ' + @rotationConstraintName);

        ALTER TABLE [client_auth_policy] DROP COLUMN [refresh_token_rotation_enabled];
      END
    `);
  }
}
