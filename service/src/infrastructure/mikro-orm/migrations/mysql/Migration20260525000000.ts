import { Migration } from '@mikro-orm/migrations';

export class Migration20260525000000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS \`scope\` (
        \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`tenant_id\` BIGINT UNSIGNED NOT NULL,
        \`name\` VARCHAR(128) NOT NULL,
        \`display_name\` VARCHAR(128) NOT NULL,
        \`description\` VARCHAR(512) NULL,
        \`claim_keys\` JSON NOT NULL,
        \`enabled\` BOOLEAN NOT NULL DEFAULT TRUE,
        \`built_in\` BOOLEAN NOT NULL DEFAULT FALSE,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`uk_scope_tenant_name\` UNIQUE (\`tenant_id\`, \`name\`),
        CONSTRAINT \`fk_scope_tenant\` FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE
      );
    `);
    this.addSql(`CREATE INDEX \`idx_scope_name\` ON \`scope\` (\`name\`);`);

    this.addSql(`
      INSERT IGNORE INTO \`scope\`
        (\`tenant_id\`, \`name\`, \`display_name\`, \`description\`, \`claim_keys\`, \`enabled\`, \`built_in\`, \`created_at\`, \`updated_at\`)
      SELECT t.id, s.name, s.display_name, s.description, JSON_ARRAY(), TRUE, TRUE, NOW(), NOW()
      FROM \`tenant\` t
      JOIN (
        SELECT 'openid' AS name, 'OpenID' AS display_name, 'OIDC authentication scope' AS description
        UNION ALL SELECT 'profile', 'Profile', 'Basic profile claims'
        UNION ALL SELECT 'email', 'Email', 'Email claims'
      ) s;
    `);
    this.addSql(`
      UPDATE \`scope\` SET \`claim_keys\` = JSON_ARRAY('profile')
      WHERE \`name\` = 'profile' AND \`built_in\` = TRUE;
    `);
    this.addSql(`
      UPDATE \`scope\` SET \`claim_keys\` = JSON_ARRAY('email')
      WHERE \`name\` = 'email' AND \`built_in\` = TRUE;
    `);
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS \`scope\`;`);
  }
}
