import { Migration } from '@mikro-orm/migrations';

export class Migration20260525010000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS \`custom_grant\` (
        \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`tenant_id\` BIGINT UNSIGNED NOT NULL,
        \`grant_type\` VARCHAR(192) NOT NULL,
        \`display_name\` VARCHAR(128) NOT NULL,
        \`description\` VARCHAR(512) NULL,
        \`enabled\` BOOLEAN NOT NULL DEFAULT TRUE,
        \`allowed_client_types\` JSON NOT NULL,
        \`allowed_application_types\` JSON NOT NULL,
        \`requires_client_authentication\` BOOLEAN NOT NULL DEFAULT TRUE,
        \`requires_grant_types\` JSON NOT NULL,
        \`built_in\` BOOLEAN NOT NULL DEFAULT FALSE,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`uk_custom_grant_tenant_grant_type\` UNIQUE (\`tenant_id\`, \`grant_type\`),
        CONSTRAINT \`fk_custom_grant_tenant\` FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE
      );
    `);
    this.addSql(`
      CREATE INDEX \`idx_custom_grant_grant_type\`
        ON \`custom_grant\` (\`grant_type\`);
    `);
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS \`custom_grant\`;`);
  }
}
