import { Migration } from '@mikro-orm/migrations';

export class Migration20260911000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      'ALTER TABLE `client` ADD COLUMN `external_interaction_ui_url` varchar(2048) NULL;',
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      'ALTER TABLE `client` DROP COLUMN `external_interaction_ui_url`;',
    );
  }
}
