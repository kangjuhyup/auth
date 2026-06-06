import { Migration } from '@mikro-orm/migrations';

export class Migration20260524020000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      ALTER TABLE "client_auth_policy"
      ADD COLUMN IF NOT EXISTS "allowed_idp_provider_keys" JSON NULL;
    `);

    this.addSql(`
      ALTER TABLE "client_auth_policy"
      ADD COLUMN IF NOT EXISTS "reauthentication_interval_sec" INTEGER NULL;
    `);
  }

  async down(): Promise<void> {
    this.addSql(`
      ALTER TABLE "client_auth_policy"
      DROP COLUMN IF EXISTS "reauthentication_interval_sec";
    `);

    this.addSql(`
      ALTER TABLE "client_auth_policy"
      DROP COLUMN IF EXISTS "allowed_idp_provider_keys";
    `);
  }
}
