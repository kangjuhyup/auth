import { Migration } from '@mikro-orm/migrations';

export class Migration20260404000002 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      ALTER TABLE "tenant_config"
        ADD COLUMN access_token_ttl_sec  INT NOT NULL DEFAULT 3600,
        ADD COLUMN refresh_token_ttl_sec INT NOT NULL DEFAULT 1209600;
    `);

    this.addSql(`
      ALTER TABLE "client"
        ADD COLUMN access_token_ttl_sec  INT,
        ADD COLUMN refresh_token_ttl_sec INT;
    `);
  }

  async down(): Promise<void> {
    this.addSql(`
      ALTER TABLE "client"
        DROP COLUMN IF EXISTS access_token_ttl_sec,
        DROP COLUMN IF EXISTS refresh_token_ttl_sec;
    `);

    this.addSql(`
      ALTER TABLE "tenant_config"
        DROP COLUMN IF EXISTS access_token_ttl_sec,
        DROP COLUMN IF EXISTS refresh_token_ttl_sec;
    `);
  }
}
