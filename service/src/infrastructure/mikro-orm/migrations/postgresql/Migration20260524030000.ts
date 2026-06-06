import { Migration } from '@mikro-orm/migrations';

export class Migration20260524030000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      ALTER TABLE "user"
      ADD COLUMN IF NOT EXISTS "mfa_enabled" BOOLEAN NOT NULL DEFAULT FALSE;
    `);
  }

  async down(): Promise<void> {
    this.addSql(`
      ALTER TABLE "user"
      DROP COLUMN IF EXISTS "mfa_enabled";
    `);
  }
}
