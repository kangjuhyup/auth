import { Migration } from '@mikro-orm/migrations';

export class Migration20260831000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql('DELETE FROM "oidc_session_index";');
    this.addSql('DELETE FROM "oidc_model";');
    this.addSql('DROP INDEX IF EXISTS "idx_oidc_model_kind_uid";');
    this.addSql('DROP INDEX IF EXISTS "idx_oidc_model_kind_grant";');
    this.addSql('DROP INDEX IF EXISTS "idx_oidc_model_kind_usercode";');
    this.addSql(
      'ALTER TABLE "oidc_model" ADD COLUMN "tenant_id" VARCHAR(64) NOT NULL;',
    );
    this.addSql('ALTER TABLE "oidc_model" DROP CONSTRAINT "oidc_model_pkey";');
    this.addSql(
      'ALTER TABLE "oidc_model" ADD CONSTRAINT "oidc_model_pkey" PRIMARY KEY ("tenant_id", "kind", "id");',
    );
    this.addSql(
      'CREATE INDEX "idx_oidc_model_tenant_kind_uid" ON "oidc_model" ("tenant_id", "kind", "uid");',
    );
    this.addSql(
      'CREATE INDEX "idx_oidc_model_tenant_kind_grant" ON "oidc_model" ("tenant_id", "kind", "grant_id");',
    );
    this.addSql(
      'CREATE INDEX "idx_oidc_model_tenant_kind_usercode" ON "oidc_model" ("tenant_id", "kind", "user_code");',
    );
    this.addSql('DROP INDEX IF EXISTS "idx_oidc_session_idx_grant";');
    this.addSql(
      'ALTER TABLE "oidc_session_index" DROP CONSTRAINT "oidc_session_index_pkey";',
    );
    this.addSql(
      'ALTER TABLE "oidc_session_index" ADD CONSTRAINT "oidc_session_index_pkey" PRIMARY KEY ("tenant_id", "session_id", "client_id");',
    );
    this.addSql(
      'CREATE INDEX "idx_oidc_session_idx_grant" ON "oidc_session_index" ("tenant_id", "grant_id");',
    );
  }

  override async down(): Promise<void> {
    this.addSql('DELETE FROM "oidc_session_index";');
    this.addSql('DELETE FROM "oidc_model";');
    this.addSql('DROP INDEX IF EXISTS "idx_oidc_session_idx_grant";');
    this.addSql(
      'ALTER TABLE "oidc_session_index" DROP CONSTRAINT "oidc_session_index_pkey";',
    );
    this.addSql(
      'ALTER TABLE "oidc_session_index" ADD CONSTRAINT "oidc_session_index_pkey" PRIMARY KEY ("session_id", "client_id");',
    );
    this.addSql(
      'CREATE INDEX "idx_oidc_session_idx_grant" ON "oidc_session_index" ("grant_id");',
    );
    this.addSql('DROP INDEX IF EXISTS "idx_oidc_model_tenant_kind_uid";');
    this.addSql('DROP INDEX IF EXISTS "idx_oidc_model_tenant_kind_grant";');
    this.addSql('DROP INDEX IF EXISTS "idx_oidc_model_tenant_kind_usercode";');
    this.addSql('ALTER TABLE "oidc_model" DROP CONSTRAINT "oidc_model_pkey";');
    this.addSql('ALTER TABLE "oidc_model" DROP COLUMN "tenant_id";');
    this.addSql(
      'ALTER TABLE "oidc_model" ADD CONSTRAINT "oidc_model_pkey" PRIMARY KEY ("id");',
    );
    this.addSql(
      'CREATE INDEX "idx_oidc_model_kind_uid" ON "oidc_model" ("kind", "uid");',
    );
    this.addSql(
      'CREATE INDEX "idx_oidc_model_kind_grant" ON "oidc_model" ("kind", "grant_id");',
    );
    this.addSql(
      'CREATE INDEX "idx_oidc_model_kind_usercode" ON "oidc_model" ("kind", "user_code");',
    );
  }
}
