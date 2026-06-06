import { Migration } from '@mikro-orm/migrations';

export class Migration20260524010000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      ALTER TABLE "event"
      ADD COLUMN IF NOT EXISTS "correlation_id" VARCHAR(128) NULL;
    `);

    this.addSql(`
      CREATE INDEX IF NOT EXISTS "idx_event_correlation_time"
      ON "event" ("correlation_id", "occurred_at");
    `);
  }

  async down(): Promise<void> {
    this.addSql(`
      DROP INDEX IF EXISTS "idx_event_correlation_time";
    `);

    this.addSql(`
      ALTER TABLE "event"
      DROP COLUMN IF EXISTS "correlation_id";
    `);
  }
}
