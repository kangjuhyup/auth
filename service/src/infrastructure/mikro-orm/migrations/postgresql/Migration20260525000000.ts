import { Migration } from '@mikro-orm/migrations';

export class Migration20260525000000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "scope" (
        id BIGSERIAL PRIMARY KEY,
        tenant_id BIGINT NOT NULL REFERENCES "tenant"(id) ON DELETE CASCADE,
        name VARCHAR(128) NOT NULL,
        display_name VARCHAR(128) NOT NULL,
        description VARCHAR(512),
        claim_keys JSONB NOT NULL DEFAULT '[]'::jsonb,
        enabled BOOLEAN NOT NULL DEFAULT true,
        built_in BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uk_scope_tenant_name UNIQUE (tenant_id, name)
      );
    `);
    this.addSql(`CREATE INDEX IF NOT EXISTS idx_scope_name ON "scope" (name);`);

    this.addSql(`
      INSERT INTO "scope" (tenant_id, name, display_name, description, claim_keys, enabled, built_in, created_at, updated_at)
      SELECT t.id, s.name, s.display_name, s.description, s.claim_keys::jsonb, true, true, NOW(), NOW()
      FROM "tenant" t
      CROSS JOIN (
        VALUES
          ('openid', 'OpenID', 'OIDC authentication scope', '[]'),
          ('profile', 'Profile', 'Basic profile claims', '["profile"]'),
          ('email', 'Email', 'Email claims', '["email"]')
      ) AS s(name, display_name, description, claim_keys)
      ON CONFLICT (tenant_id, name) DO NOTHING;
    `);
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "scope";`);
  }
}
