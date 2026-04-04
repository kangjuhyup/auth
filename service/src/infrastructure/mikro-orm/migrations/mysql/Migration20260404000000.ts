import { Migration } from '@mikro-orm/migrations';

export class Migration20260404000000 extends Migration {
  async up(): Promise<void> {
    // ------------------------------------------------------------------ tenant
    this.addSql(`
      CREATE TABLE \`tenant\` (
        \`id\`         BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
        \`code\`       VARCHAR(64)  NOT NULL,
        \`name\`       VARCHAR(128) NOT NULL,
        \`created_at\` DATETIME,
        \`updated_at\` DATETIME,
        CONSTRAINT uk_tenant_code UNIQUE (\`code\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    this.addSql(`CREATE INDEX idx_tenant_code ON \`tenant\` (\`code\`);`);

    // ----------------------------------------------------------- tenant_config
    this.addSql(`
      CREATE TABLE \`tenant_config\` (
        \`tenant_id\`             BIGINT      NOT NULL,
        \`signup_policy\`         VARCHAR(10) NOT NULL DEFAULT 'open',
        \`require_phone_verify\`  TINYINT(1)  NOT NULL DEFAULT 0,
        \`brand_name\`            VARCHAR(128),
        \`access_token_ttl_sec\`  INT          NOT NULL DEFAULT 3600,
        \`refresh_token_ttl_sec\` INT          NOT NULL DEFAULT 1209600,
        \`extra\`                 JSON,
        PRIMARY KEY (\`tenant_id\`),
        CONSTRAINT fk_tc_tenant FOREIGN KEY (\`tenant_id\`)
          REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // --------------------------------------------------------------- user
    this.addSql(`
      CREATE TABLE \`user\` (
        \`id\`              CHAR(26)     NOT NULL,
        \`tenant_id\`       BIGINT       NOT NULL,
        \`username\`        VARCHAR(128) NOT NULL,
        \`email\`           VARCHAR(191),
        \`email_verified\`  TINYINT(1)   NOT NULL DEFAULT 0,
        \`phone\`           VARCHAR(32),
        \`phone_verified\`  TINYINT(1)   NOT NULL DEFAULT 0,
        \`status\`          VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
        \`created_at\`      DATETIME,
        \`updated_at\`      DATETIME,
        PRIMARY KEY (\`id\`),
        CONSTRAINT uk_user_tenant_username UNIQUE (\`tenant_id\`, \`username\`),
        CONSTRAINT uk_user_tenant_email    UNIQUE (\`tenant_id\`, \`email\`),
        CONSTRAINT fk_user_tenant FOREIGN KEY (\`tenant_id\`)
          REFERENCES \`tenant\`(\`id\`) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    this.addSql(`CREATE INDEX idx_user_username ON \`user\` (\`username\`);`);

    // -------------------------------------------------------------- group
    this.addSql(`
      CREATE TABLE \`group\` (
        \`id\`         BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
        \`tenant_id\`  BIGINT       NOT NULL,
        \`code\`       VARCHAR(128) NOT NULL,
        \`name\`       VARCHAR(128) NOT NULL,
        \`parent_id\`  BIGINT,
        \`created_at\` DATETIME,
        \`updated_at\` DATETIME,
        CONSTRAINT uk_grp_tenant_code UNIQUE (\`tenant_id\`, \`code\`),
        CONSTRAINT fk_group_tenant FOREIGN KEY (\`tenant_id\`)
          REFERENCES \`tenant\`(\`id\`) ON DELETE RESTRICT,
        CONSTRAINT fk_group_parent FOREIGN KEY (\`parent_id\`)
          REFERENCES \`group\`(\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    this.addSql(`CREATE INDEX idx_group_code ON \`group\` (\`code\`);`);

    // --------------------------------------------------------------- role
    this.addSql(`
      CREATE TABLE \`role\` (
        \`id\`          BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
        \`tenant_id\`   BIGINT       NOT NULL,
        \`code\`        VARCHAR(128) NOT NULL,
        \`name\`        VARCHAR(128) NOT NULL,
        \`description\` VARCHAR(255),
        \`created_at\`  DATETIME,
        \`updated_at\`  DATETIME,
        CONSTRAINT uk_role_tenant_code UNIQUE (\`tenant_id\`, \`code\`),
        CONSTRAINT fk_role_tenant FOREIGN KEY (\`tenant_id\`)
          REFERENCES \`tenant\`(\`id\`) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    this.addSql(`CREATE INDEX idx_role_code ON \`role\` (\`code\`);`);

    // ------------------------------------------------------------ permission
    this.addSql(`
      CREATE TABLE \`permission\` (
        \`id\`          BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
        \`tenant_id\`   BIGINT       NOT NULL,
        \`code\`        VARCHAR(128) NOT NULL,
        \`resource\`    VARCHAR(128),
        \`action\`      VARCHAR(64),
        \`description\` VARCHAR(255),
        \`created_at\`  DATETIME,
        \`updated_at\`  DATETIME,
        CONSTRAINT uk_perm_tenant_code UNIQUE (\`tenant_id\`, \`code\`),
        CONSTRAINT fk_perm_tenant FOREIGN KEY (\`tenant_id\`)
          REFERENCES \`tenant\`(\`id\`) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    this.addSql(`CREATE INDEX idx_perm_code     ON \`permission\` (\`code\`);`);
    this.addSql(`CREATE INDEX idx_perm_resource ON \`permission\` (\`resource\`);`);
    this.addSql(`CREATE INDEX idx_perm_action   ON \`permission\` (\`action\`);`);

    // --------------------------------------------------------------- client
    this.addSql(`
      CREATE TABLE \`client\` (
        \`id\`                         BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
        \`tenant_id\`                  BIGINT       NOT NULL,
        \`client_id\`                  VARCHAR(128) NOT NULL,
        \`secret_enc\`                 VARCHAR(512),
        \`name\`                       VARCHAR(128) NOT NULL,
        \`type\`                       VARCHAR(20)  NOT NULL DEFAULT 'public',
        \`enabled\`                    TINYINT(1)   NOT NULL DEFAULT 1,
        \`redirect_uris\`              JSON         NOT NULL,
        \`grant_types\`                JSON         NOT NULL,
        \`response_types\`             JSON         NOT NULL,
        \`token_endpoint_auth_method\` VARCHAR(40)  NOT NULL DEFAULT 'none',
        \`scope\`                      VARCHAR(512) NOT NULL DEFAULT 'openid',
        \`post_logout_redirect_uris\`  JSON         NOT NULL,
        \`application_type\`           VARCHAR(10)  NOT NULL DEFAULT 'web',
        \`backchannel_logout_uri\`      VARCHAR(512),
        \`frontchannel_logout_uri\`     VARCHAR(512),
        \`access_token_ttl_sec\`       INT,
        \`refresh_token_ttl_sec\`      INT,
        \`allowed_resources\`          JSON         NOT NULL,
        \`skip_consent\`               TINYINT(1)   NOT NULL DEFAULT 0,
        \`created_at\`                 DATETIME,
        \`updated_at\`                 DATETIME,
        CONSTRAINT uk_client_tenant_clientid UNIQUE (\`tenant_id\`, \`client_id\`),
        CONSTRAINT fk_client_tenant FOREIGN KEY (\`tenant_id\`)
          REFERENCES \`tenant\`(\`id\`) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    this.addSql(`CREATE INDEX idx_client_client_id ON \`client\` (\`client_id\`);`);

    // ---------------------------------------------------- identity_provider
    this.addSql(`
      CREATE TABLE \`identity_provider\` (
        \`id\`            BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
        \`tenant_id\`     BIGINT       NOT NULL,
        \`provider\`      VARCHAR(20)  NOT NULL,
        \`client_id\`     VARCHAR(191) NOT NULL,
        \`client_secret\` VARCHAR(255),
        \`redirect_uri\`  VARCHAR(255) NOT NULL,
        \`enabled\`       TINYINT(1)   NOT NULL DEFAULT 1,
        \`created_at\`    DATETIME,
        \`updated_at\`    DATETIME,
        CONSTRAINT uk_idp UNIQUE (\`tenant_id\`, \`provider\`),
        CONSTRAINT fk_idp_tenant FOREIGN KEY (\`tenant_id\`)
          REFERENCES \`tenant\`(\`id\`) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // --------------------------------------------------------------- jwks_key
    this.addSql(`
      CREATE TABLE \`jwks_key\` (
        \`kid\`             VARCHAR(64)  NOT NULL PRIMARY KEY,
        \`tenant_id\`       BIGINT       NOT NULL,
        \`algorithm\`       VARCHAR(16)  NOT NULL,
        \`public_key\`      TEXT         NOT NULL,
        \`private_key_enc\` TEXT         NOT NULL,
        \`status\`          VARCHAR(16)  NOT NULL DEFAULT 'active',
        \`rotated_at\`      DATETIME,
        \`expires_at\`      DATETIME,
        \`created_at\`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_jwks_tenant FOREIGN KEY (\`tenant_id\`)
          REFERENCES \`tenant\`(\`id\`) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    this.addSql(`CREATE INDEX idx_jwks_tenant_status ON \`jwks_key\` (\`tenant_id\`, \`status\`);`);

    // --------------------------------------------------------- tenant_client
    this.addSql(`
      CREATE TABLE \`tenant_client\` (
        \`id\`         BIGINT     NOT NULL AUTO_INCREMENT PRIMARY KEY,
        \`tenant_id\`  BIGINT     NOT NULL,
        \`client_id\`  BIGINT     NOT NULL,
        \`enabled\`    TINYINT(1) NOT NULL DEFAULT 1,
        \`created_at\` DATETIME,
        \`updated_at\` DATETIME,
        CONSTRAINT uk_tc UNIQUE (\`tenant_id\`, \`client_id\`),
        CONSTRAINT fk_tc_tenant FOREIGN KEY (\`tenant_id\`)
          REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE,
        CONSTRAINT fk_tc_client FOREIGN KEY (\`client_id\`)
          REFERENCES \`client\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // -------------------------------------------------- client_auth_policy
    this.addSql(`
      CREATE TABLE \`client_auth_policy\` (
        \`id\`                       BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
        \`tenant_id\`                BIGINT       NOT NULL,
        \`client_id\`                BIGINT       NOT NULL,
        \`allowed_auth_methods\`     JSON         NOT NULL,
        \`default_acr\`              VARCHAR(128) NOT NULL DEFAULT 'urn:auth:pwd',
        \`mfa_required\`             TINYINT(1)   NOT NULL DEFAULT 0,
        \`allowed_mfa_methods\`      JSON         NOT NULL,
        \`max_session_duration_sec\` INT,
        \`consent_required\`         TINYINT(1)   NOT NULL DEFAULT 1,
        \`require_auth_time\`        TINYINT(1)   NOT NULL DEFAULT 0,
        \`created_at\`               DATETIME,
        \`updated_at\`               DATETIME,
        CONSTRAINT uk_client_auth_policy_client UNIQUE (\`client_id\`),
        CONSTRAINT fk_cap_tenant FOREIGN KEY (\`tenant_id\`)
          REFERENCES \`tenant\`(\`id\`) ON DELETE RESTRICT,
        CONSTRAINT fk_cap_client FOREIGN KEY (\`client_id\`)
          REFERENCES \`client\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // -------------------------------------------------------- user_credential
    this.addSql(`
      CREATE TABLE \`user_credential\` (
        \`id\`           BIGINT      NOT NULL AUTO_INCREMENT PRIMARY KEY,
        \`user_id\`      CHAR(26)    NOT NULL,
        \`type\`         VARCHAR(20) NOT NULL,
        \`secret_hash\`  VARCHAR(255) NOT NULL,
        \`hash_alg\`     VARCHAR(64),
        \`hash_params\`  JSON,
        \`hash_version\` INT,
        \`enabled\`      TINYINT(1)  NOT NULL DEFAULT 1,
        \`expires_at\`   DATETIME,
        \`created_at\`   DATETIME,
        \`updated_at\`   DATETIME,
        CONSTRAINT fk_ucred_user FOREIGN KEY (\`user_id\`)
          REFERENCES \`user\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    this.addSql(`CREATE INDEX idx_ucred_user_type ON \`user_credential\` (\`user_id\`, \`type\`);`);

    // ------------------------------------------------------------- user_group
    this.addSql(`
      CREATE TABLE \`user_group\` (
        \`user_id\`  CHAR(26) NOT NULL,
        \`group_id\` BIGINT   NOT NULL,
        PRIMARY KEY (\`user_id\`, \`group_id\`),
        CONSTRAINT fk_ug_user  FOREIGN KEY (\`user_id\`)  REFERENCES \`user\`(\`id\`)  ON DELETE CASCADE,
        CONSTRAINT fk_ug_group FOREIGN KEY (\`group_id\`) REFERENCES \`group\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // -------------------------------------------------------------- user_role
    this.addSql(`
      CREATE TABLE \`user_role\` (
        \`user_id\`   CHAR(26) NOT NULL,
        \`role_id\`   BIGINT   NOT NULL,
        \`client_id\` BIGINT,
        PRIMARY KEY (\`user_id\`, \`role_id\`),
        CONSTRAINT uk_user_role_user_role_client UNIQUE (\`user_id\`, \`role_id\`, \`client_id\`),
        CONSTRAINT fk_ur_user   FOREIGN KEY (\`user_id\`)   REFERENCES \`user\`(\`id\`)   ON DELETE CASCADE,
        CONSTRAINT fk_ur_role   FOREIGN KEY (\`role_id\`)   REFERENCES \`role\`(\`id\`)   ON DELETE CASCADE,
        CONSTRAINT fk_ur_client FOREIGN KEY (\`client_id\`) REFERENCES \`client\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // ---------------------------------------------------------- user_identity
    this.addSql(`
      CREATE TABLE \`user_identity\` (
        \`id\`           BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
        \`tenant_id\`    BIGINT       NOT NULL,
        \`user_id\`      CHAR(26)     NOT NULL,
        \`provider\`     VARCHAR(20)  NOT NULL,
        \`provider_sub\` VARCHAR(191) NOT NULL,
        \`email\`        VARCHAR(191),
        \`profile_json\` JSON,
        \`linked_at\`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`created_at\`   DATETIME,
        \`updated_at\`   DATETIME,
        CONSTRAINT uk_user_identity UNIQUE (\`tenant_id\`, \`provider\`, \`provider_sub\`),
        CONSTRAINT fk_ui_tenant FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenant\`(\`id\`) ON DELETE RESTRICT,
        CONSTRAINT fk_ui_user   FOREIGN KEY (\`user_id\`)   REFERENCES \`user\`(\`id\`)   ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    this.addSql(`CREATE INDEX idx_ui_provider_sub ON \`user_identity\` (\`provider_sub\`);`);

    // ------------------------------------------------------------- group_role
    this.addSql(`
      CREATE TABLE \`group_role\` (
        \`grp_id\`    BIGINT NOT NULL,
        \`role_id\`   BIGINT NOT NULL,
        \`client_id\` BIGINT,
        PRIMARY KEY (\`grp_id\`, \`role_id\`),
        CONSTRAINT uk_group_role_group_role_client UNIQUE (\`grp_id\`, \`role_id\`, \`client_id\`),
        CONSTRAINT fk_gr_group  FOREIGN KEY (\`grp_id\`)    REFERENCES \`group\`(\`id\`)  ON DELETE CASCADE,
        CONSTRAINT fk_gr_role   FOREIGN KEY (\`role_id\`)   REFERENCES \`role\`(\`id\`)   ON DELETE CASCADE,
        CONSTRAINT fk_gr_client FOREIGN KEY (\`client_id\`) REFERENCES \`client\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // --------------------------------------------------------- role_permission
    this.addSql(`
      CREATE TABLE \`role_permission\` (
        \`role_id\`       BIGINT NOT NULL,
        \`permission_id\` BIGINT NOT NULL,
        PRIMARY KEY (\`role_id\`, \`permission_id\`),
        CONSTRAINT fk_rp_role       FOREIGN KEY (\`role_id\`)       REFERENCES \`role\`(\`id\`)       ON DELETE CASCADE,
        CONSTRAINT fk_rp_permission FOREIGN KEY (\`permission_id\`) REFERENCES \`permission\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // ----------------------------------------------------------- role_inherit
    this.addSql(`
      CREATE TABLE \`role_inherit\` (
        \`parent_role_id\` BIGINT NOT NULL,
        \`child_role_id\`  BIGINT NOT NULL,
        PRIMARY KEY (\`parent_role_id\`, \`child_role_id\`),
        CONSTRAINT chk_ri_diff CHECK (\`parent_role_id\` <> \`child_role_id\`),
        CONSTRAINT fk_ri_parent FOREIGN KEY (\`parent_role_id\`) REFERENCES \`role\`(\`id\`) ON DELETE CASCADE,
        CONSTRAINT fk_ri_child  FOREIGN KEY (\`child_role_id\`)  REFERENCES \`role\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // --------------------------------------------------------------- consent
    this.addSql(`
      CREATE TABLE \`consent\` (
        \`id\`             BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
        \`tenant_id\`      BIGINT       NOT NULL,
        \`user_id\`        CHAR(26)     NOT NULL,
        \`client_id\`      BIGINT       NOT NULL,
        \`granted_scopes\` VARCHAR(512) NOT NULL,
        \`granted_at\`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`revoked_at\`     DATETIME,
        CONSTRAINT uk_consent_tenant_user_client UNIQUE (\`tenant_id\`, \`user_id\`, \`client_id\`),
        CONSTRAINT fk_consent_tenant FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE,
        CONSTRAINT fk_consent_user   FOREIGN KEY (\`user_id\`)   REFERENCES \`user\`(\`id\`)   ON DELETE CASCADE,
        CONSTRAINT fk_consent_client FOREIGN KEY (\`client_id\`) REFERENCES \`client\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // --------------------------------------------------------------- event
    this.addSql(`
      CREATE TABLE \`event\` (
        \`id\`            BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
        \`tenant_id\`     BIGINT       NOT NULL,
        \`user_id\`       CHAR(26),
        \`client_id\`     BIGINT,
        \`category\`      VARCHAR(20)  NOT NULL,
        \`severity\`      VARCHAR(20)  NOT NULL,
        \`action\`        VARCHAR(20)  NOT NULL,
        \`resource_type\` VARCHAR(64),
        \`resource_id\`   VARCHAR(191),
        \`success\`       TINYINT(1)   NOT NULL DEFAULT 1,
        \`reason\`        VARCHAR(255),
        \`ip\`            BLOB,
        \`user_agent\`    VARCHAR(255),
        \`metadata\`      JSON,
        \`occurred_at\`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_event_tenant FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE,
        CONSTRAINT fk_event_user   FOREIGN KEY (\`user_id\`)   REFERENCES \`user\`(\`id\`)   ON DELETE SET NULL,
        CONSTRAINT fk_event_client FOREIGN KEY (\`client_id\`) REFERENCES \`client\`(\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    this.addSql(`CREATE INDEX idx_event_tenant_time   ON \`event\` (\`tenant_id\`, \`occurred_at\`);`);
    this.addSql(`CREATE INDEX idx_event_category_time ON \`event\` (\`category\`, \`occurred_at\`);`);
    this.addSql(`CREATE INDEX idx_event_user_time     ON \`event\` (\`user_id\`, \`occurred_at\`);`);
    this.addSql(`CREATE INDEX idx_event_client_time   ON \`event\` (\`client_id\`, \`occurred_at\`);`);
    this.addSql(`CREATE INDEX idx_event_action_time   ON \`event\` (\`action\`, \`occurred_at\`);`);

    // ------------------------------------------------------------- otp_token
    this.addSql(`
      CREATE TABLE \`otp_token\` (
        \`id\`          CHAR(26)     NOT NULL PRIMARY KEY,
        \`tenant_id\`   VARCHAR(64)  NOT NULL,
        \`user_id\`     CHAR(26)     NOT NULL,
        \`purpose\`     VARCHAR(32)  NOT NULL,
        \`request_id\`  CHAR(26)     NOT NULL,
        \`token_hash\`  VARCHAR(128) NOT NULL,
        \`issued_at\`   DATETIME     NOT NULL,
        \`expires_at\`  DATETIME     NOT NULL,
        \`consumed_at\` DATETIME,
        \`created_at\`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uk_otp_token_request_id UNIQUE (\`request_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    this.addSql(`CREATE INDEX idx_otp_tenant_user_purpose ON \`otp_token\` (\`tenant_id\`, \`user_id\`, \`purpose\`);`);
    this.addSql(`CREATE INDEX idx_otp_expires_at          ON \`otp_token\` (\`expires_at\`);`);

    // ------------------------------------------------------------ oidc_model
    this.addSql(`
      CREATE TABLE \`oidc_model\` (
        \`id\`          VARCHAR(128) NOT NULL PRIMARY KEY,
        \`kind\`        VARCHAR(64)  NOT NULL,
        \`payload\`     JSON         NOT NULL,
        \`uid\`         VARCHAR(128),
        \`grant_id\`    VARCHAR(128),
        \`user_code\`   VARCHAR(128),
        \`consumed_at\` DATETIME,
        \`expires_at\`  DATETIME,
        \`created_at\`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    this.addSql(`CREATE INDEX idx_oidc_model_kind_uid      ON \`oidc_model\` (\`kind\`, \`uid\`);`);
    this.addSql(`CREATE INDEX idx_oidc_model_kind_grant    ON \`oidc_model\` (\`kind\`, \`grant_id\`);`);
    this.addSql(`CREATE INDEX idx_oidc_model_kind_usercode ON \`oidc_model\` (\`kind\`, \`user_code\`);`);
  }

  async down(): Promise<void> {
    const tables = [
      'oidc_model', 'otp_token', 'event', 'consent',
      'role_inherit', 'role_permission', 'group_role',
      'user_identity', 'user_role', 'user_group', 'user_credential',
      'client_auth_policy', 'tenant_client', 'jwks_key', 'identity_provider',
      'client', 'permission', 'role', 'group', 'user',
      'tenant_config', 'tenant',
    ];
    this.addSql(`SET FOREIGN_KEY_CHECKS = 0;`);
    for (const t of tables) {
      this.addSql(`DROP TABLE IF EXISTS \`${t}\`;`);
    }
    this.addSql(`SET FOREIGN_KEY_CHECKS = 1;`);
  }
}
