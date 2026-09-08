import { Migration } from '@mikro-orm/migrations';

export class Migration20260906000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      'CREATE INDEX `idx_oidc_model_expires_at` ON `oidc_model` (`expires_at`);',
    );
  }

  override async down(): Promise<void> {
    this.addSql('DROP INDEX `idx_oidc_model_expires_at` ON `oidc_model`;');
  }
}
