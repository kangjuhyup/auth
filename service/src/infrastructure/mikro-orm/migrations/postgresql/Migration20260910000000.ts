import { Migration } from '@mikro-orm/migrations';

export class Migration20260910000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `UPDATE "user" SET "status" = 'DISABLED' WHERE "status" = 'PENDING_REGISTRATION';`,
    );
    this.addSql('DROP INDEX IF EXISTS "uk_user_tenant_registration_attempt";');
    this.addSql(
      'ALTER TABLE "user" DROP COLUMN "account_registration_id", DROP COLUMN "registration_attempt_id", ADD COLUMN "provisioned_by_client_id" varchar(191) NULL, ADD COLUMN "provisioning_key_hash" char(64) NULL;',
    );
    this.addSql(
      'CREATE UNIQUE INDEX "uk_user_tenant_provisioning_key" ON "user" ("tenant_id", "provisioned_by_client_id", "provisioning_key_hash") WHERE "provisioned_by_client_id" IS NOT NULL AND "provisioning_key_hash" IS NOT NULL;',
    );
  }

  override async down(): Promise<void> {
    this.addSql('DROP INDEX IF EXISTS "uk_user_tenant_provisioning_key";');
    this.addSql(
      'ALTER TABLE "user" DROP COLUMN "provisioned_by_client_id", DROP COLUMN "provisioning_key_hash", ADD COLUMN "account_registration_id" varchar(191) NULL, ADD COLUMN "registration_attempt_id" varchar(191) NULL;',
    );
    this.addSql(
      'CREATE UNIQUE INDEX "uk_user_tenant_registration_attempt" ON "user" ("tenant_id", "registration_attempt_id") WHERE "registration_attempt_id" IS NOT NULL;',
    );
  }
}
