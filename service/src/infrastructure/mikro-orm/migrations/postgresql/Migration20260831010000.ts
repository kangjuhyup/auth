import { Migration } from '@mikro-orm/migrations';

export class Migration20260831010000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `ALTER TABLE "client" ADD COLUMN "introspection_resources" JSON NOT NULL DEFAULT '[]';`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `ALTER TABLE "client" DROP COLUMN "introspection_resources";`,
    );
  }
}
