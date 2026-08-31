import { Migration } from '@mikro-orm/migrations';

export class Migration20260831010000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      'ALTER TABLE `client` ADD COLUMN `introspection_resources` JSON NULL;',
    );
    this.addSql(
      'UPDATE `client` SET `introspection_resources` = JSON_ARRAY() WHERE `introspection_resources` IS NULL;',
    );
    this.addSql(
      'ALTER TABLE `client` MODIFY COLUMN `introspection_resources` JSON NOT NULL;',
    );
  }

  override async down(): Promise<void> {
    this.addSql('ALTER TABLE `client` DROP COLUMN `introspection_resources`;');
  }
}
