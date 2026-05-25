import { Migration } from '@mikro-orm/migrations';

export class Migration20260525020000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      ALTER TABLE \`client_auth_policy\`
      ADD COLUMN \`login_session_mode\` VARCHAR(16) NULL;
    `);
    this.addSql(`
      ALTER TABLE \`client_auth_policy\`
      ADD COLUMN \`max_concurrent_sessions\` INTEGER NULL;
    `);
    this.addSql(`
      ALTER TABLE \`client_auth_policy\`
      ADD COLUMN \`session_conflict_action\` VARCHAR(32) NULL;
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`
      ALTER TABLE \`client_auth_policy\`
      DROP COLUMN \`session_conflict_action\`;
    `);
    this.addSql(`
      ALTER TABLE \`client_auth_policy\`
      DROP COLUMN \`max_concurrent_sessions\`;
    `);
    this.addSql(`
      ALTER TABLE \`client_auth_policy\`
      DROP COLUMN \`login_session_mode\`;
    `);
  }
}
