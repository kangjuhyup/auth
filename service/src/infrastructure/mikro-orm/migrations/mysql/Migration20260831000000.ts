import { Migration } from '@mikro-orm/migrations';

export class Migration20260831000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql('DELETE FROM `oidc_session_index`;');
    this.addSql('DELETE FROM `oidc_model`;');
    this.addSql('DROP INDEX `idx_oidc_model_kind_uid` ON `oidc_model`;');
    this.addSql('DROP INDEX `idx_oidc_model_kind_grant` ON `oidc_model`;');
    this.addSql('DROP INDEX `idx_oidc_model_kind_usercode` ON `oidc_model`;');
    this.addSql(
      'ALTER TABLE `oidc_model` ADD COLUMN `tenant_id` VARCHAR(64) NOT NULL FIRST, DROP PRIMARY KEY, ADD PRIMARY KEY (`tenant_id`, `kind`, `id`);',
    );
    this.addSql(
      'CREATE INDEX `idx_oidc_model_tenant_kind_uid` ON `oidc_model` (`tenant_id`, `kind`, `uid`);',
    );
    this.addSql(
      'CREATE INDEX `idx_oidc_model_tenant_kind_grant` ON `oidc_model` (`tenant_id`, `kind`, `grant_id`);',
    );
    this.addSql(
      'CREATE INDEX `idx_oidc_model_tenant_kind_usercode` ON `oidc_model` (`tenant_id`, `kind`, `user_code`);',
    );
    this.addSql(
      'DROP INDEX `idx_oidc_session_idx_grant` ON `oidc_session_index`;',
    );
    this.addSql(
      'ALTER TABLE `oidc_session_index` DROP PRIMARY KEY, ADD PRIMARY KEY (`tenant_id`, `session_id`, `client_id`);',
    );
    this.addSql(
      'CREATE INDEX `idx_oidc_session_idx_grant` ON `oidc_session_index` (`tenant_id`, `grant_id`);',
    );
  }

  override async down(): Promise<void> {
    this.addSql('DELETE FROM `oidc_session_index`;');
    this.addSql('DELETE FROM `oidc_model`;');
    this.addSql(
      'DROP INDEX `idx_oidc_session_idx_grant` ON `oidc_session_index`;',
    );
    this.addSql(
      'ALTER TABLE `oidc_session_index` DROP PRIMARY KEY, ADD PRIMARY KEY (`session_id`, `client_id`);',
    );
    this.addSql(
      'CREATE INDEX `idx_oidc_session_idx_grant` ON `oidc_session_index` (`grant_id`);',
    );
    this.addSql('DROP INDEX `idx_oidc_model_tenant_kind_uid` ON `oidc_model`;');
    this.addSql(
      'DROP INDEX `idx_oidc_model_tenant_kind_grant` ON `oidc_model`;',
    );
    this.addSql(
      'DROP INDEX `idx_oidc_model_tenant_kind_usercode` ON `oidc_model`;',
    );
    this.addSql(
      'ALTER TABLE `oidc_model` DROP PRIMARY KEY, DROP COLUMN `tenant_id`, ADD PRIMARY KEY (`id`);',
    );
    this.addSql(
      'CREATE INDEX `idx_oidc_model_kind_uid` ON `oidc_model` (`kind`, `uid`);',
    );
    this.addSql(
      'CREATE INDEX `idx_oidc_model_kind_grant` ON `oidc_model` (`kind`, `grant_id`);',
    );
    this.addSql(
      'CREATE INDEX `idx_oidc_model_kind_usercode` ON `oidc_model` (`kind`, `user_code`);',
    );
  }
}
