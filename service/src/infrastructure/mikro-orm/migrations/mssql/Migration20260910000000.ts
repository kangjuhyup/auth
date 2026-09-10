import { Migration } from '@mikro-orm/migrations';

export class Migration20260910000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      "UPDATE [user] SET [status] = 'DISABLED' WHERE [status] = 'PENDING_REGISTRATION';",
    );
    this.addSql('DROP INDEX [uk_user_tenant_registration_attempt] ON [user];');
    this.addSql(
      'ALTER TABLE [user] DROP COLUMN [account_registration_id], [registration_attempt_id];',
    );
    this.addSql(
      'ALTER TABLE [user] ADD [provisioned_by_client_id] varchar(191) NULL, [provisioning_key_hash] char(64) NULL;',
    );
    this.addSql(
      'CREATE UNIQUE INDEX [uk_user_tenant_provisioning_key] ON [user] ([tenant_id], [provisioned_by_client_id], [provisioning_key_hash]) WHERE [provisioned_by_client_id] IS NOT NULL AND [provisioning_key_hash] IS NOT NULL;',
    );
  }

  override async down(): Promise<void> {
    this.addSql('DROP INDEX [uk_user_tenant_provisioning_key] ON [user];');
    this.addSql(
      'ALTER TABLE [user] DROP COLUMN [provisioned_by_client_id], [provisioning_key_hash];',
    );
    this.addSql(
      'ALTER TABLE [user] ADD [account_registration_id] varchar(191) NULL, [registration_attempt_id] varchar(191) NULL;',
    );
    this.addSql(
      'CREATE UNIQUE INDEX [uk_user_tenant_registration_attempt] ON [user] ([tenant_id], [registration_attempt_id]) WHERE [registration_attempt_id] IS NOT NULL;',
    );
  }
}
