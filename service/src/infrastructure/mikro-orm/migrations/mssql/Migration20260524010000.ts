import { Migration } from '@mikro-orm/migrations';

export class Migration20260524010000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      IF COL_LENGTH('dbo.event', 'correlation_id') IS NULL
      BEGIN
        ALTER TABLE [event]
        ADD [correlation_id] NVARCHAR(128) NULL;
      END
    `);

    this.addSql(`
      IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = 'idx_event_correlation_time'
          AND object_id = OBJECT_ID('dbo.event')
      )
      BEGIN
        CREATE INDEX [idx_event_correlation_time]
        ON [event] ([correlation_id], [occurred_at]);
      END
    `);
  }

  async down(): Promise<void> {
    this.addSql(`
      IF EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = 'idx_event_correlation_time'
          AND object_id = OBJECT_ID('dbo.event')
      )
      BEGIN
        DROP INDEX [idx_event_correlation_time] ON [event];
      END
    `);

    this.addSql(`
      IF COL_LENGTH('dbo.event', 'correlation_id') IS NOT NULL
      BEGIN
        ALTER TABLE [event] DROP COLUMN [correlation_id];
      END
    `);
  }
}
