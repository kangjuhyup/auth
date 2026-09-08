import { Migration } from '@mikro-orm/migrations';

export class Migration20260908000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      'ALTER TABLE `user` ADD COLUMN `account_registration_id` varchar(191) NULL, ADD COLUMN `registration_attempt_id` varchar(191) NULL;',
    );
    this.addSql(
      'CREATE UNIQUE INDEX `uk_user_tenant_registration_attempt` ON `user` (`tenant_id`, `registration_attempt_id`);',
    );
  }

  override async down(): Promise<void> {
    this.addSql('DROP INDEX `uk_user_tenant_registration_attempt` ON `user`;');
    this.addSql(
      'ALTER TABLE `user` DROP COLUMN `account_registration_id`, DROP COLUMN `registration_attempt_id`;',
    );
  }
}
