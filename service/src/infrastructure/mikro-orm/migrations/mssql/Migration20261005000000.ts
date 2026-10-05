import { Migration } from '@mikro-orm/migrations';
export class Migration20261005000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      'CREATE TABLE [external_signup_completion] (id char(26) NOT NULL PRIMARY KEY, tenant_id bigint NOT NULL, user_id char(26) NOT NULL, consumer_client_id varchar(191) NOT NULL, client_id varchar(191) NOT NULL, key_hash char(64) NOT NULL, provider varchar(64) NOT NULL, provider_sub varchar(191) NOT NULL, created_at datetime2 NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at datetime2 NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT uk_external_signup_completion UNIQUE (tenant_id, consumer_client_id, key_hash), CONSTRAINT fk_external_signup_tenant FOREIGN KEY (tenant_id) REFERENCES [tenant](id), CONSTRAINT fk_external_signup_user FOREIGN KEY (user_id) REFERENCES [user](id));',
    );
  }
  override async down(): Promise<void> {
    this.addSql('DROP TABLE [external_signup_completion];');
  }
}
