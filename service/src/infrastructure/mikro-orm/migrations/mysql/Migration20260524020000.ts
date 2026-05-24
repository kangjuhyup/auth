import { Migration } from '@mikro-orm/migrations';

export class Migration20260524020000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      ALTER TABLE \`client_auth_policy\`
      ADD COLUMN \`allowed_idp_provider_keys\` JSON NULL;
    `);

    this.addSql(`
      ALTER TABLE \`client_auth_policy\`
      ADD COLUMN \`reauthentication_interval_sec\` INTEGER NULL;
    `);
  }

  async down(): Promise<void> {
    this.addSql(`
      ALTER TABLE \`client_auth_policy\`
      DROP COLUMN \`reauthentication_interval_sec\`;
    `);

    this.addSql(`
      ALTER TABLE \`client_auth_policy\`
      DROP COLUMN \`allowed_idp_provider_keys\`;
    `);
  }
}
