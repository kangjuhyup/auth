import { Migration } from '@mikro-orm/migrations';

export class Migration20260404000000 extends Migration {
  async up(): Promise<void> {
    // ------------------------------------------------------------------ tenant
    this.addSql(`
      CREATE TABLE "tenant" (
        id          BIGSERIAL    PRIMARY KEY,
        code        VARCHAR(64)  NOT NULL,
        name        VARCHAR(128) NOT NULL,
        created_at  TIMESTAMP,
        updated_at  TIMESTAMP
      );
    `);
    this.addSql(`CREATE UNIQUE INDEX uk_tenant_code ON "tenant" (code);`);

    // ----------------------------------------------------------- tenant_config
    this.addSql(`
      CREATE TABLE "tenant_config" (
        tenant_id             BIGINT      NOT NULL PRIMARY KEY,
        signup_policy         VARCHAR(10) NOT NULL DEFAULT 'open',
        require_phone_verify  BOOLEAN     NOT NULL DEFAULT false,
        brand_name            VARCHAR(128),
        access_token_ttl_sec  INT          NOT NULL DEFAULT 3600,
        refresh_token_ttl_sec INT          NOT NULL DEFAULT 1209600,
        extra                 JSON,
        CONSTRAINT fk_tc_tenant FOREIGN KEY (tenant_id)
          REFERENCES "tenant"(id) ON DELETE CASCADE
      );
    `);

    // --------------------------------------------------------------- "user"
    this.addSql(`
      CREATE TABLE "user" (
        id              CHAR(26)     NOT NULL PRIMARY KEY,
        tenant_id       BIGINT       NOT NULL,
        username        VARCHAR(128) NOT NULL,
        email           VARCHAR(191),
        email_verified  BOOLEAN      NOT NULL DEFAULT false,
        phone           VARCHAR(32),
        phone_verified  BOOLEAN      NOT NULL DEFAULT false,
        status          VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
        created_at      TIMESTAMP,
        updated_at      TIMESTAMP,
        CONSTRAINT fk_user_tenant FOREIGN KEY (tenant_id)
          REFERENCES "tenant"(id) ON DELETE RESTRICT
      );
    `);
    this.addSql(`CREATE UNIQUE INDEX uk_user_tenant_username ON "user" (tenant_id, username);`);
    this.addSql(`CREATE UNIQUE INDEX uk_user_tenant_email   ON "user" (tenant_id, email);`);
    this.addSql(`CREATE INDEX ON "user" (username);`);

    // -------------------------------------------------------------- "group"
    this.addSql(`
      CREATE TABLE "group" (
        id          BIGSERIAL    PRIMARY KEY,
        tenant_id   BIGINT       NOT NULL,
        code        VARCHAR(128) NOT NULL,
        name        VARCHAR(128) NOT NULL,
        parent_id   BIGINT,
        created_at  TIMESTAMP,
        updated_at  TIMESTAMP,
        CONSTRAINT fk_group_tenant FOREIGN KEY (tenant_id)
          REFERENCES "tenant"(id) ON DELETE RESTRICT,
        CONSTRAINT fk_group_parent FOREIGN KEY (parent_id)
          REFERENCES "group"(id) ON DELETE SET NULL
      );
    `);
    this.addSql(`CREATE UNIQUE INDEX uk_grp_tenant_code ON "group" (tenant_id, code);`);
    this.addSql(`CREATE INDEX ON "group" (code);`);

    // --------------------------------------------------------------- role
    this.addSql(`
      CREATE TABLE "role" (
        id          BIGSERIAL    PRIMARY KEY,
        tenant_id   BIGINT       NOT NULL,
        code        VARCHAR(128) NOT NULL,
        name        VARCHAR(128) NOT NULL,
        description VARCHAR(255),
        created_at  TIMESTAMP,
        updated_at  TIMESTAMP,
        CONSTRAINT fk_role_tenant FOREIGN KEY (tenant_id)
          REFERENCES "tenant"(id) ON DELETE RESTRICT
      );
    `);
    this.addSql(`CREATE UNIQUE INDEX uk_role_tenant_code ON "role" (tenant_id, code);`);
    this.addSql(`CREATE INDEX ON "role" (code);`);

    // ------------------------------------------------------------ permission
    this.addSql(`
      CREATE TABLE "permission" (
        id          BIGSERIAL    PRIMARY KEY,
        tenant_id   BIGINT       NOT NULL,
        code        VARCHAR(128) NOT NULL,
        resource    VARCHAR(128),
        action      VARCHAR(64),
        description VARCHAR(255),
        created_at  TIMESTAMP,
        updated_at  TIMESTAMP,
        CONSTRAINT fk_perm_tenant FOREIGN KEY (tenant_id)
          REFERENCES "tenant"(id) ON DELETE RESTRICT
      );
    `);
    this.addSql(`CREATE UNIQUE INDEX uk_perm_tenant_code ON "permission" (tenant_id, code);`);
    this.addSql(`CREATE INDEX ON "permission" (code);`);
    this.addSql(`CREATE INDEX ON "permission" (resource);`);
    this.addSql(`CREATE INDEX ON "permission" (action);`);

    // --------------------------------------------------------------- client
    this.addSql(`
      CREATE TABLE "client" (
        id                          BIGSERIAL    PRIMARY KEY,
        tenant_id                   BIGINT       NOT NULL,
        client_id                   VARCHAR(128) NOT NULL,
        secret_enc                  VARCHAR(512),
        name                        VARCHAR(128) NOT NULL,
        type                        VARCHAR(20)  NOT NULL DEFAULT 'public',
        enabled                     BOOLEAN      NOT NULL DEFAULT true,
        redirect_uris               JSON         NOT NULL DEFAULT '[]',
        grant_types                 JSON         NOT NULL DEFAULT '["authorization_code"]',
        response_types              JSON         NOT NULL DEFAULT '["code"]',
        token_endpoint_auth_method  VARCHAR(40)  NOT NULL DEFAULT 'none',
        scope                       VARCHAR(512) NOT NULL DEFAULT 'openid',
        post_logout_redirect_uris   JSON         NOT NULL DEFAULT '[]',
        application_type            VARCHAR(10)  NOT NULL DEFAULT 'web',
        backchannel_logout_uri      VARCHAR(512),
        frontchannel_logout_uri     VARCHAR(512),
        access_token_ttl_sec        INT,
        refresh_token_ttl_sec       INT,
        allowed_resources           JSON         NOT NULL DEFAULT '[]',
        skip_consent                BOOLEAN      NOT NULL DEFAULT false,
        created_at                  TIMESTAMP,
        updated_at                  TIMESTAMP,
        CONSTRAINT fk_client_tenant FOREIGN KEY (tenant_id)
          REFERENCES "tenant"(id) ON DELETE RESTRICT
      );
    `);
    this.addSql(`CREATE UNIQUE INDEX uk_client_tenant_clientid ON "client" (tenant_id, client_id);`);
    this.addSql(`CREATE INDEX ON "client" (client_id);`);

    // ---------------------------------------------------- identity_provider
    this.addSql(`
      CREATE TABLE "identity_provider" (
        id             BIGSERIAL    PRIMARY KEY,
        tenant_id      BIGINT       NOT NULL,
        provider       VARCHAR(64)  NOT NULL,
        display_name   VARCHAR(50)  NOT NULL,
        client_id      VARCHAR(191) NOT NULL,
        client_secret  VARCHAR(255),
        redirect_uri   VARCHAR(255) NOT NULL,
        enabled        BOOLEAN      NOT NULL DEFAULT true,
        oauth_config   JSONB        NULL,
        created_at     TIMESTAMP,
        updated_at     TIMESTAMP,
        CONSTRAINT uk_idp UNIQUE (tenant_id, provider),
        CONSTRAINT fk_idp_tenant FOREIGN KEY (tenant_id)
          REFERENCES "tenant"(id) ON DELETE RESTRICT
      );
    `);

    // --------------------------------------------------------------- jwks_key
    this.addSql(`
      CREATE TABLE "jwks_key" (
        kid              VARCHAR(64)  NOT NULL PRIMARY KEY,
        tenant_id        BIGINT       NOT NULL,
        algorithm        VARCHAR(16)  NOT NULL,
        public_key       TEXT         NOT NULL,
        private_key_enc  TEXT         NOT NULL,
        status           VARCHAR(16)  NOT NULL DEFAULT 'active',
        rotated_at       TIMESTAMP,
        expires_at       TIMESTAMP,
        created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_jwks_tenant FOREIGN KEY (tenant_id)
          REFERENCES "tenant"(id) ON DELETE RESTRICT
      );
    `);
    this.addSql(`CREATE INDEX idx_jwks_tenant_status ON "jwks_key" (tenant_id, status);`);

    // --------------------------------------------------------- tenant_client
    this.addSql(`
      CREATE TABLE "tenant_client" (
        id         BIGSERIAL PRIMARY KEY,
        tenant_id  BIGINT    NOT NULL,
        client_id  BIGINT    NOT NULL,
        enabled    BOOLEAN   NOT NULL DEFAULT true,
        created_at TIMESTAMP,
        updated_at TIMESTAMP,
        CONSTRAINT uk_tc UNIQUE (tenant_id, client_id),
        CONSTRAINT fk_tc_tenant FOREIGN KEY (tenant_id)
          REFERENCES "tenant"(id) ON DELETE CASCADE,
        CONSTRAINT fk_tc_client FOREIGN KEY (client_id)
          REFERENCES "client"(id) ON DELETE CASCADE
      );
    `);

    // -------------------------------------------------- client_auth_policy
    this.addSql(`
      CREATE TABLE "client_auth_policy" (
        id                      BIGSERIAL    PRIMARY KEY,
        tenant_id               BIGINT       NOT NULL,
        client_id               BIGINT       NOT NULL,
        allowed_auth_methods    JSON         NOT NULL DEFAULT '["password"]',
        default_acr             VARCHAR(128) NOT NULL DEFAULT 'urn:auth:pwd',
        mfa_required            BOOLEAN      NOT NULL DEFAULT false,
        allowed_mfa_methods     JSON         NOT NULL DEFAULT '["totp"]',
        max_session_duration_sec INTEGER,
        consent_required        BOOLEAN      NOT NULL DEFAULT true,
        require_auth_time       BOOLEAN      NOT NULL DEFAULT false,
        created_at              TIMESTAMP,
        updated_at              TIMESTAMP,
        CONSTRAINT uk_client_auth_policy_client UNIQUE (client_id),
        CONSTRAINT fk_cap_tenant FOREIGN KEY (tenant_id)
          REFERENCES "tenant"(id) ON DELETE RESTRICT,
        CONSTRAINT fk_cap_client FOREIGN KEY (client_id)
          REFERENCES "client"(id) ON DELETE CASCADE
      );
    `);

    // -------------------------------------------------------- user_credential
    this.addSql(`
      CREATE TABLE "user_credential" (
        id            BIGSERIAL   PRIMARY KEY,
        user_id       CHAR(26)    NOT NULL,
        type          VARCHAR(20) NOT NULL,
        secret_hash   VARCHAR(255) NOT NULL,
        hash_alg      VARCHAR(64),
        hash_params   JSON,
        hash_version  INTEGER,
        enabled       BOOLEAN     NOT NULL DEFAULT true,
        expires_at    TIMESTAMP,
        created_at    TIMESTAMP,
        updated_at    TIMESTAMP,
        CONSTRAINT fk_ucred_user FOREIGN KEY (user_id)
          REFERENCES "user"(id) ON DELETE CASCADE
      );
    `);
    this.addSql(`CREATE INDEX idx_ucred_user_type ON "user_credential" (user_id, type);`);

    // ------------------------------------------------------------- user_group
    this.addSql(`
      CREATE TABLE "user_group" (
        user_id   CHAR(26) NOT NULL,
        group_id  BIGINT   NOT NULL,
        PRIMARY KEY (user_id, group_id),
        CONSTRAINT fk_ug_user  FOREIGN KEY (user_id)  REFERENCES "user"(id)  ON DELETE CASCADE,
        CONSTRAINT fk_ug_group FOREIGN KEY (group_id) REFERENCES "group"(id) ON DELETE CASCADE
      );
    `);

    // -------------------------------------------------------------- user_role
    this.addSql(`
      CREATE TABLE "user_role" (
        user_id   CHAR(26) NOT NULL,
        role_id   BIGINT   NOT NULL,
        client_id BIGINT,
        PRIMARY KEY (user_id, role_id),
        CONSTRAINT uk_user_role_user_role_client UNIQUE (user_id, role_id, client_id),
        CONSTRAINT fk_ur_user   FOREIGN KEY (user_id)   REFERENCES "user"(id)   ON DELETE CASCADE,
        CONSTRAINT fk_ur_role   FOREIGN KEY (role_id)   REFERENCES "role"(id)   ON DELETE CASCADE,
        CONSTRAINT fk_ur_client FOREIGN KEY (client_id) REFERENCES "client"(id) ON DELETE CASCADE
      );
    `);

    // ---------------------------------------------------------- user_identity
    this.addSql(`
      CREATE TABLE "user_identity" (
        id            BIGSERIAL    PRIMARY KEY,
        tenant_id     BIGINT       NOT NULL,
        user_id       CHAR(26)     NOT NULL,
        provider      VARCHAR(64)  NOT NULL,
        provider_sub  VARCHAR(191) NOT NULL,
        email         VARCHAR(191),
        profile_json  JSON,
        linked_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at    TIMESTAMP,
        updated_at    TIMESTAMP,
        CONSTRAINT uk_user_identity UNIQUE (tenant_id, provider, provider_sub),
        CONSTRAINT fk_ui_tenant FOREIGN KEY (tenant_id) REFERENCES "tenant"(id) ON DELETE RESTRICT,
        CONSTRAINT fk_ui_user   FOREIGN KEY (user_id)   REFERENCES "user"(id)   ON DELETE CASCADE
      );
    `);
    this.addSql(`CREATE INDEX ON "user_identity" (provider_sub);`);

    // ------------------------------------------------------------- group_role
    this.addSql(`
      CREATE TABLE "group_role" (
        grp_id    BIGINT NOT NULL,
        role_id   BIGINT NOT NULL,
        client_id BIGINT,
        PRIMARY KEY (grp_id, role_id),
        CONSTRAINT uk_group_role_group_role_client UNIQUE (grp_id, role_id, client_id),
        CONSTRAINT fk_gr_group  FOREIGN KEY (grp_id)    REFERENCES "group"(id)  ON DELETE CASCADE,
        CONSTRAINT fk_gr_role   FOREIGN KEY (role_id)   REFERENCES "role"(id)   ON DELETE CASCADE,
        CONSTRAINT fk_gr_client FOREIGN KEY (client_id) REFERENCES "client"(id) ON DELETE CASCADE
      );
    `);

    // --------------------------------------------------------- role_permission
    this.addSql(`
      CREATE TABLE "role_permission" (
        role_id       BIGINT NOT NULL,
        permission_id BIGINT NOT NULL,
        PRIMARY KEY (role_id, permission_id),
        CONSTRAINT fk_rp_role       FOREIGN KEY (role_id)       REFERENCES "role"(id)       ON DELETE CASCADE,
        CONSTRAINT fk_rp_permission FOREIGN KEY (permission_id) REFERENCES "permission"(id) ON DELETE CASCADE
      );
    `);

    // ----------------------------------------------------------- role_inherit
    this.addSql(`
      CREATE TABLE "role_inherit" (
        parent_role_id BIGINT NOT NULL,
        child_role_id  BIGINT NOT NULL,
        PRIMARY KEY (parent_role_id, child_role_id),
        CONSTRAINT chk_ri_diff CHECK (parent_role_id <> child_role_id),
        CONSTRAINT fk_ri_parent FOREIGN KEY (parent_role_id) REFERENCES "role"(id) ON DELETE CASCADE,
        CONSTRAINT fk_ri_child  FOREIGN KEY (child_role_id)  REFERENCES "role"(id) ON DELETE CASCADE
      );
    `);

    // --------------------------------------------------------------- consent
    this.addSql(`
      CREATE TABLE "consent" (
        id             BIGSERIAL    PRIMARY KEY,
        tenant_id      BIGINT       NOT NULL,
        user_id        CHAR(26)     NOT NULL,
        client_id      BIGINT       NOT NULL,
        granted_scopes VARCHAR(512) NOT NULL,
        granted_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        revoked_at     TIMESTAMP,
        CONSTRAINT uk_consent_tenant_user_client UNIQUE (tenant_id, user_id, client_id),
        CONSTRAINT fk_consent_tenant FOREIGN KEY (tenant_id) REFERENCES "tenant"(id) ON DELETE CASCADE,
        CONSTRAINT fk_consent_user   FOREIGN KEY (user_id)   REFERENCES "user"(id)   ON DELETE CASCADE,
        CONSTRAINT fk_consent_client FOREIGN KEY (client_id) REFERENCES "client"(id) ON DELETE CASCADE
      );
    `);

    // --------------------------------------------------------------- event
    this.addSql(`
      CREATE TABLE "event" (
        id            BIGSERIAL    PRIMARY KEY,
        tenant_id     BIGINT       NOT NULL,
        user_id       CHAR(26),
        client_id     BIGINT,
        category      VARCHAR(20)  NOT NULL,
        severity      VARCHAR(20)  NOT NULL,
        action        VARCHAR(20)  NOT NULL,
        resource_type VARCHAR(64),
        resource_id   VARCHAR(191),
        success       BOOLEAN      NOT NULL DEFAULT true,
        reason        VARCHAR(255),
        ip            BYTEA,
        user_agent    VARCHAR(255),
        metadata      JSON,
        occurred_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_event_tenant FOREIGN KEY (tenant_id) REFERENCES "tenant"(id) ON DELETE CASCADE,
        CONSTRAINT fk_event_user   FOREIGN KEY (user_id)   REFERENCES "user"(id)   ON DELETE SET NULL,
        CONSTRAINT fk_event_client FOREIGN KEY (client_id) REFERENCES "client"(id) ON DELETE SET NULL
      );
    `);
    this.addSql(`CREATE INDEX idx_event_tenant_time   ON "event" (tenant_id, occurred_at);`);
    this.addSql(`CREATE INDEX idx_event_category_time ON "event" (category, occurred_at);`);
    this.addSql(`CREATE INDEX idx_event_user_time     ON "event" (user_id, occurred_at);`);
    this.addSql(`CREATE INDEX idx_event_client_time   ON "event" (client_id, occurred_at);`);
    this.addSql(`CREATE INDEX idx_event_action_time   ON "event" (action, occurred_at);`);

    // ------------------------------------------------------------- otp_token
    this.addSql(`
      CREATE TABLE "otp_token" (
        id          CHAR(26)     NOT NULL PRIMARY KEY,
        tenant_id   VARCHAR(64)  NOT NULL,
        user_id     CHAR(26)     NOT NULL,
        purpose     VARCHAR(32)  NOT NULL,
        request_id  CHAR(26)     NOT NULL,
        token_hash  VARCHAR(128) NOT NULL,
        issued_at   TIMESTAMPTZ  NOT NULL,
        expires_at  TIMESTAMPTZ  NOT NULL,
        consumed_at TIMESTAMPTZ,
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uk_otp_token_request_id UNIQUE (request_id)
      );
    `);
    this.addSql(`CREATE INDEX idx_otp_tenant_user_purpose ON "otp_token" (tenant_id, user_id, purpose);`);
    this.addSql(`CREATE INDEX idx_otp_expires_at          ON "otp_token" (expires_at);`);

    // ------------------------------------------------------------ oidc_model
    this.addSql(`
      CREATE TABLE "oidc_model" (
        id          VARCHAR(128) NOT NULL PRIMARY KEY,
        kind        VARCHAR(64)  NOT NULL,
        payload     JSON         NOT NULL,
        uid         VARCHAR(128),
        grant_id    VARCHAR(128),
        user_code   VARCHAR(128),
        consumed_at TIMESTAMP,
        expires_at  TIMESTAMP,
        created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    this.addSql(`CREATE INDEX idx_oidc_model_kind_uid      ON "oidc_model" (kind, uid);`);
    this.addSql(`CREATE INDEX idx_oidc_model_kind_grant    ON "oidc_model" (kind, grant_id);`);
    this.addSql(`CREATE INDEX idx_oidc_model_kind_usercode ON "oidc_model" (kind, user_code);`);
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "oidc_model"         CASCADE;`);
    this.addSql(`DROP TABLE IF EXISTS "otp_token"          CASCADE;`);
    this.addSql(`DROP TABLE IF EXISTS "event"              CASCADE;`);
    this.addSql(`DROP TABLE IF EXISTS "consent"            CASCADE;`);
    this.addSql(`DROP TABLE IF EXISTS "role_inherit"       CASCADE;`);
    this.addSql(`DROP TABLE IF EXISTS "role_permission"    CASCADE;`);
    this.addSql(`DROP TABLE IF EXISTS "group_role"         CASCADE;`);
    this.addSql(`DROP TABLE IF EXISTS "user_identity"      CASCADE;`);
    this.addSql(`DROP TABLE IF EXISTS "user_role"          CASCADE;`);
    this.addSql(`DROP TABLE IF EXISTS "user_group"         CASCADE;`);
    this.addSql(`DROP TABLE IF EXISTS "user_credential"    CASCADE;`);
    this.addSql(`DROP TABLE IF EXISTS "client_auth_policy" CASCADE;`);
    this.addSql(`DROP TABLE IF EXISTS "tenant_client"      CASCADE;`);
    this.addSql(`DROP TABLE IF EXISTS "jwks_key"           CASCADE;`);
    this.addSql(`DROP TABLE IF EXISTS "identity_provider"  CASCADE;`);
    this.addSql(`DROP TABLE IF EXISTS "client"             CASCADE;`);
    this.addSql(`DROP TABLE IF EXISTS "permission"         CASCADE;`);
    this.addSql(`DROP TABLE IF EXISTS "role"               CASCADE;`);
    this.addSql(`DROP TABLE IF EXISTS "group"              CASCADE;`);
    this.addSql(`DROP TABLE IF EXISTS "user"               CASCADE;`);
    this.addSql(`DROP TABLE IF EXISTS "tenant_config"      CASCADE;`);
    this.addSql(`DROP TABLE IF EXISTS "tenant"             CASCADE;`);
  }
}
