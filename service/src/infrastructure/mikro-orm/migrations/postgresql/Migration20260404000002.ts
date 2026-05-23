import { Migration } from '@mikro-orm/migrations';

export class Migration20260404000002 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      ALTER TABLE "identity_provider"
      ADD COLUMN IF NOT EXISTS "protocol" VARCHAR(16) NOT NULL DEFAULT 'oauth2';
    `);

    this.addSql(`
      ALTER TABLE "identity_provider"
      ADD COLUMN IF NOT EXISTS "saml_config" JSONB NULL;
    `);
  }

  async down(): Promise<void> {
    this.addSql(`
      ALTER TABLE "identity_provider"
      DROP COLUMN IF EXISTS "saml_config";
    `);

    this.addSql(`
      ALTER TABLE "identity_provider"
      DROP COLUMN IF EXISTS "protocol";
    `);
  }
}
