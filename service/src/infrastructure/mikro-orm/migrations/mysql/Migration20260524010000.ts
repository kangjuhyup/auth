import { Migration } from '@mikro-orm/migrations';

export class Migration20260524010000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      ALTER TABLE \`event\`
      ADD COLUMN \`correlation_id\` VARCHAR(128) NULL;
    `);

    this.addSql(`
      CREATE INDEX \`idx_event_correlation_time\`
      ON \`event\` (\`correlation_id\`, \`occurred_at\`);
    `);
  }

  async down(): Promise<void> {
    this.addSql(`
      DROP INDEX \`idx_event_correlation_time\` ON \`event\`;
    `);

    this.addSql(`
      ALTER TABLE \`event\`
      DROP COLUMN \`correlation_id\`;
    `);
  }
}
