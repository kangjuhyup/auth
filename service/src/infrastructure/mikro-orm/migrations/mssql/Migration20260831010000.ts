import { Migration } from '@mikro-orm/migrations';

export class Migration20260831010000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      "ALTER TABLE [client] ADD [introspection_resources] NVARCHAR(MAX) NOT NULL CONSTRAINT [df_client_introspection_resources] DEFAULT '[]';",
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      'ALTER TABLE [client] DROP CONSTRAINT [df_client_introspection_resources];',
    );
    this.addSql('ALTER TABLE [client] DROP COLUMN [introspection_resources];');
  }
}
