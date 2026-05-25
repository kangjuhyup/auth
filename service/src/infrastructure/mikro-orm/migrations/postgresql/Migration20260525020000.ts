import { Migration } from '@mikro-orm/migrations';

export class Migration20260525020000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      ALTER TABLE "client_auth_policy"
      ADD COLUMN IF NOT EXISTS "login_session_mode" VARCHAR(16) NULL;
    `);
    this.addSql(`
      ALTER TABLE "client_auth_policy"
      ADD COLUMN IF NOT EXISTS "max_concurrent_sessions" INTEGER NULL;
    `);
    this.addSql(`
      ALTER TABLE "client_auth_policy"
      ADD COLUMN IF NOT EXISTS "session_conflict_action" VARCHAR(32) NULL;
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`
      ALTER TABLE "client_auth_policy"
      DROP COLUMN IF EXISTS "session_conflict_action";
    `);
    this.addSql(`
      ALTER TABLE "client_auth_policy"
      DROP COLUMN IF EXISTS "max_concurrent_sessions";
    `);
    this.addSql(`
      ALTER TABLE "client_auth_policy"
      DROP COLUMN IF EXISTS "login_session_mode";
    `);
  }
}
