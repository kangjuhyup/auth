import { Migration } from '@mikro-orm/migrations';

export class Migration20260525010000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "custom_grant" (
        id BIGSERIAL PRIMARY KEY,
        tenant_id BIGINT NOT NULL REFERENCES "tenant"(id) ON DELETE CASCADE,
        grant_type VARCHAR(192) NOT NULL,
        display_name VARCHAR(128) NOT NULL,
        description VARCHAR(512),
        enabled BOOLEAN NOT NULL DEFAULT true,
        allowed_client_types JSONB NOT NULL DEFAULT '[]'::jsonb,
        allowed_application_types JSONB NOT NULL DEFAULT '[]'::jsonb,
        requires_client_authentication BOOLEAN NOT NULL DEFAULT true,
        requires_grant_types JSONB NOT NULL DEFAULT '[]'::jsonb,
        built_in BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uk_custom_grant_tenant_grant_type UNIQUE (tenant_id, grant_type)
      );
    `);
    this.addSql(`
      CREATE INDEX IF NOT EXISTS idx_custom_grant_grant_type
        ON "custom_grant" (grant_type);
    `);
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "custom_grant";`);
  }
}
