import { Migration } from '@mikro-orm/migrations';

export class Migration20260829000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "bootstrap_process" (
        "process_key" VARCHAR(128) NOT NULL PRIMARY KEY,
        "step" VARCHAR(64) NOT NULL,
        "status" VARCHAR(16) NOT NULL,
        "retry_count" INT NOT NULL DEFAULT 0,
        "last_failure_code" VARCHAR(64) NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "bootstrap_process";`);
  }
}
