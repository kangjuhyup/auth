import { Migration } from '@mikro-orm/migrations';

export class Migration20260524000000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      ALTER TABLE "client_auth_policy"
      ADD COLUMN IF NOT EXISTS "refresh_token_rotation_enabled" BOOLEAN NOT NULL DEFAULT TRUE;
    `);

    this.addSql(`
      ALTER TABLE "client_auth_policy"
      ADD COLUMN IF NOT EXISTS "refresh_token_reuse_action" VARCHAR(32) NOT NULL DEFAULT 'revoke_grant';
    `);
  }

  async down(): Promise<void> {
    this.addSql(`
      ALTER TABLE "client_auth_policy"
      DROP COLUMN IF EXISTS "refresh_token_reuse_action";
    `);

    this.addSql(`
      ALTER TABLE "client_auth_policy"
      DROP COLUMN IF EXISTS "refresh_token_rotation_enabled";
    `);
  }
}
