import { Migration } from '@mikro-orm/migrations';

export class Migration20260404000002 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      ALTER TABLE \`identity_provider\`
      ADD COLUMN \`protocol\` VARCHAR(16) NOT NULL DEFAULT 'oauth2';
    `);

    this.addSql(`
      ALTER TABLE \`identity_provider\`
      ADD COLUMN \`saml_config\` JSON NULL;
    `);
  }

  async down(): Promise<void> {
    this.addSql(`
      ALTER TABLE \`identity_provider\`
      DROP COLUMN \`saml_config\`;
    `);

    this.addSql(`
      ALTER TABLE \`identity_provider\`
      DROP COLUMN \`protocol\`;
    `);
  }
}
