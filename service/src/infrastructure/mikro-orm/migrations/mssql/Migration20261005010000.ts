import { Migration } from '@mikro-orm/migrations';

export class Migration20261005010000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      'ALTER TABLE [identity_provider] ALTER COLUMN [client_secret] varchar(2048) NULL;',
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      'ALTER TABLE [identity_provider] ALTER COLUMN [client_secret] varchar(255) NULL;',
    );
  }
}
