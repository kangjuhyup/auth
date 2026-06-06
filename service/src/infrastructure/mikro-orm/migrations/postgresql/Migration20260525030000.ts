import { Migration } from '@mikro-orm/migrations';

export class Migration20260525030000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "oidc_session_index" (
        "session_id" VARCHAR(128) NOT NULL,
        "tenant_id" VARCHAR(64) NOT NULL,
        "client_id" VARCHAR(128) NOT NULL,
        "account_id" VARCHAR(128) NOT NULL,
        "grant_id" VARCHAR(128) NULL,
        "expires_at" TIMESTAMP NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "oidc_session_index_pkey" PRIMARY KEY ("session_id", "client_id")
      );
    `);
    this.addSql(`
      CREATE INDEX IF NOT EXISTS idx_oidc_session_idx_lookup
      ON "oidc_session_index" ("tenant_id", "client_id", "account_id", "expires_at");
    `);
    this.addSql(`
      CREATE INDEX IF NOT EXISTS idx_oidc_session_idx_grant
      ON "oidc_session_index" ("grant_id");
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "oidc_session_index";`);
  }
}
