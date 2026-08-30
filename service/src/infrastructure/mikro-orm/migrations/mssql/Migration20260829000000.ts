import { Migration } from '@mikro-orm/migrations';

export class Migration20260829000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      IF OBJECT_ID(N'dbo.[bootstrap_process]', N'U') IS NULL
      CREATE TABLE [bootstrap_process] (
        [process_key] NVARCHAR(128) NOT NULL PRIMARY KEY,
        [step] NVARCHAR(64) NOT NULL,
        [status] NVARCHAR(16) NOT NULL,
        [retry_count] INT NOT NULL DEFAULT 0,
        [last_failure_code] NVARCHAR(64) NULL,
        [created_at] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        [updated_at] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      );
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`
      IF OBJECT_ID(N'dbo.[bootstrap_process]', N'U') IS NOT NULL
        DROP TABLE [bootstrap_process];
    `);
  }
}
