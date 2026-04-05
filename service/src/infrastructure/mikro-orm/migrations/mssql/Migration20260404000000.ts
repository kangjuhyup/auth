import { Migration } from '@mikro-orm/migrations';

export class Migration20260404000000 extends Migration {
  async up(): Promise<void> {
    // ------------------------------------------------------------------ tenant
    this.addSql(`
      IF OBJECT_ID(N'dbo.[tenant]', N'U') IS NULL
      CREATE TABLE [tenant] (
        [id]         BIGINT        NOT NULL IDENTITY(1,1) PRIMARY KEY,
        [code]       NVARCHAR(64)  NOT NULL,
        [name]       NVARCHAR(128) NOT NULL,
        [created_at] DATETIME2,
        [updated_at] DATETIME2,
        CONSTRAINT uk_tenant_code UNIQUE ([code])
      );
    `);

    // ----------------------------------------------------------- tenant_config
    this.addSql(`
      IF OBJECT_ID(N'dbo.[tenant_config]', N'U') IS NULL
      CREATE TABLE [tenant_config] (
        [tenant_id]            BIGINT      NOT NULL,
        [signup_policy]        NVARCHAR(10) NOT NULL DEFAULT 'open',
        [require_phone_verify] BIT          NOT NULL DEFAULT 0,
        [brand_name]           NVARCHAR(128),
        [access_token_ttl_sec]  INT          NOT NULL DEFAULT 3600,
        [refresh_token_ttl_sec] INT          NOT NULL DEFAULT 1209600,
        [extra]                NVARCHAR(MAX),
        CONSTRAINT pk_tenant_config PRIMARY KEY ([tenant_id]),
        CONSTRAINT fk_tc_tenant FOREIGN KEY ([tenant_id])
          REFERENCES [tenant]([id]) ON DELETE CASCADE
      );
    `);

    // --------------------------------------------------------------- user
    this.addSql(`
      IF OBJECT_ID(N'dbo.[user]', N'U') IS NULL
      CREATE TABLE [user] (
        [id]             CHAR(26)      NOT NULL,
        [tenant_id]      BIGINT        NOT NULL,
        [username]       NVARCHAR(128) NOT NULL,
        [email]          NVARCHAR(191),
        [email_verified] BIT           NOT NULL DEFAULT 0,
        [phone]          NVARCHAR(32),
        [phone_verified] BIT           NOT NULL DEFAULT 0,
        [status]         NVARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
        [created_at]     DATETIME2,
        [updated_at]     DATETIME2,
        CONSTRAINT pk_user PRIMARY KEY ([id]),
        CONSTRAINT uk_user_tenant_username UNIQUE ([tenant_id], [username]),
        CONSTRAINT uk_user_tenant_email    UNIQUE ([tenant_id], [email]),
        CONSTRAINT fk_user_tenant FOREIGN KEY ([tenant_id])
          REFERENCES [tenant]([id]) ON DELETE NO ACTION
      );
    `);
    this.addSql(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_user_username' AND object_id = OBJECT_ID('[user]'))
        CREATE INDEX idx_user_username ON [user] ([username]);
    `);

    // -------------------------------------------------------------- group
    this.addSql(`
      IF OBJECT_ID(N'dbo.[group]', N'U') IS NULL
      CREATE TABLE [group] (
        [id]         BIGINT        NOT NULL IDENTITY(1,1) PRIMARY KEY,
        [tenant_id]  BIGINT        NOT NULL,
        [code]       NVARCHAR(128) NOT NULL,
        [name]       NVARCHAR(128) NOT NULL,
        [parent_id]  BIGINT,
        [created_at] DATETIME2,
        [updated_at] DATETIME2,
        CONSTRAINT uk_grp_tenant_code UNIQUE ([tenant_id], [code]),
        CONSTRAINT fk_group_tenant FOREIGN KEY ([tenant_id])
          REFERENCES [tenant]([id]) ON DELETE NO ACTION,
        CONSTRAINT fk_group_parent FOREIGN KEY ([parent_id])
          REFERENCES [group]([id]) ON DELETE NO ACTION
      );
    `);
    this.addSql(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_group_code' AND object_id = OBJECT_ID('[group]'))
        CREATE INDEX idx_group_code ON [group] ([code]);
    `);

    // --------------------------------------------------------------- role
    this.addSql(`
      IF OBJECT_ID(N'dbo.[role]', N'U') IS NULL
      CREATE TABLE [role] (
        [id]          BIGINT        NOT NULL IDENTITY(1,1) PRIMARY KEY,
        [tenant_id]   BIGINT        NOT NULL,
        [code]        NVARCHAR(128) NOT NULL,
        [name]        NVARCHAR(128) NOT NULL,
        [description] NVARCHAR(255),
        [created_at]  DATETIME2,
        [updated_at]  DATETIME2,
        CONSTRAINT uk_role_tenant_code UNIQUE ([tenant_id], [code]),
        CONSTRAINT fk_role_tenant FOREIGN KEY ([tenant_id])
          REFERENCES [tenant]([id]) ON DELETE NO ACTION
      );
    `);
    this.addSql(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_role_code' AND object_id = OBJECT_ID('[role]'))
        CREATE INDEX idx_role_code ON [role] ([code]);
    `);

    // ------------------------------------------------------------ permission
    this.addSql(`
      IF OBJECT_ID(N'dbo.[permission]', N'U') IS NULL
      CREATE TABLE [permission] (
        [id]          BIGINT        NOT NULL IDENTITY(1,1) PRIMARY KEY,
        [tenant_id]   BIGINT        NOT NULL,
        [code]        NVARCHAR(128) NOT NULL,
        [resource]    NVARCHAR(128),
        [action]      NVARCHAR(64),
        [description] NVARCHAR(255),
        [created_at]  DATETIME2,
        [updated_at]  DATETIME2,
        CONSTRAINT uk_perm_tenant_code UNIQUE ([tenant_id], [code]),
        CONSTRAINT fk_perm_tenant FOREIGN KEY ([tenant_id])
          REFERENCES [tenant]([id]) ON DELETE NO ACTION
      );
    `);
    this.addSql(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_perm_code' AND object_id = OBJECT_ID('[permission]'))
        CREATE INDEX idx_perm_code     ON [permission] ([code]);
    `);
    this.addSql(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_perm_resource' AND object_id = OBJECT_ID('[permission]'))
        CREATE INDEX idx_perm_resource ON [permission] ([resource]);
    `);
    this.addSql(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_perm_action' AND object_id = OBJECT_ID('[permission]'))
        CREATE INDEX idx_perm_action   ON [permission] ([action]);
    `);

    // --------------------------------------------------------------- client
    this.addSql(`
      IF OBJECT_ID(N'dbo.[client]', N'U') IS NULL
      CREATE TABLE [client] (
        [id]                         BIGINT        NOT NULL IDENTITY(1,1) PRIMARY KEY,
        [tenant_id]                  BIGINT        NOT NULL,
        [client_id]                  NVARCHAR(128) NOT NULL,
        [secret_enc]                 NVARCHAR(512),
        [name]                       NVARCHAR(128) NOT NULL,
        [type]                       NVARCHAR(20)  NOT NULL DEFAULT 'public',
        [enabled]                    BIT           NOT NULL DEFAULT 1,
        [redirect_uris]              NVARCHAR(MAX) NOT NULL DEFAULT '[]',
        [grant_types]                NVARCHAR(MAX) NOT NULL DEFAULT '["authorization_code"]',
        [response_types]             NVARCHAR(MAX) NOT NULL DEFAULT '["code"]',
        [token_endpoint_auth_method] NVARCHAR(40)  NOT NULL DEFAULT 'none',
        [scope]                      NVARCHAR(512) NOT NULL DEFAULT 'openid',
        [post_logout_redirect_uris]  NVARCHAR(MAX) NOT NULL DEFAULT '[]',
        [application_type]           NVARCHAR(10)  NOT NULL DEFAULT 'web',
        [backchannel_logout_uri]     NVARCHAR(512),
        [frontchannel_logout_uri]    NVARCHAR(512),
        [access_token_ttl_sec]       INT,
        [refresh_token_ttl_sec]      INT,
        [allowed_resources]          NVARCHAR(MAX) NOT NULL DEFAULT '[]',
        [skip_consent]               BIT           NOT NULL DEFAULT 0,
        [created_at]                 DATETIME2,
        [updated_at]                 DATETIME2,
        CONSTRAINT uk_client_tenant_clientid UNIQUE ([tenant_id], [client_id]),
        CONSTRAINT fk_client_tenant FOREIGN KEY ([tenant_id])
          REFERENCES [tenant]([id]) ON DELETE NO ACTION
      );
    `);
    this.addSql(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_client_id' AND object_id = OBJECT_ID('[client]'))
        CREATE INDEX idx_client_id ON [client] ([client_id]);
    `);

    // ---------------------------------------------------- identity_provider
    this.addSql(`
      IF OBJECT_ID(N'dbo.[identity_provider]', N'U') IS NULL
      CREATE TABLE [identity_provider] (
        [id]            BIGINT        NOT NULL IDENTITY(1,1) PRIMARY KEY,
        [tenant_id]     BIGINT        NOT NULL,
        [provider]      NVARCHAR(20)  NOT NULL,
        [display_name]  NVARCHAR(50)  NOT NULL,
        [client_id]     NVARCHAR(191) NOT NULL,
        [client_secret] NVARCHAR(255),
        [redirect_uri]  NVARCHAR(255) NOT NULL,
        [enabled]       BIT           NOT NULL DEFAULT 1,
        [oauth_config]  NVARCHAR(MAX) NULL,
        [created_at]    DATETIME2,
        [updated_at]    DATETIME2,
        CONSTRAINT uk_idp UNIQUE ([tenant_id], [provider]),
        CONSTRAINT fk_idp_tenant FOREIGN KEY ([tenant_id])
          REFERENCES [tenant]([id]) ON DELETE NO ACTION
      );
    `);

    // --------------------------------------------------------------- jwks_key
    this.addSql(`
      IF OBJECT_ID(N'dbo.[jwks_key]', N'U') IS NULL
      CREATE TABLE [jwks_key] (
        [kid]             NVARCHAR(64)  NOT NULL PRIMARY KEY,
        [tenant_id]       BIGINT        NOT NULL,
        [algorithm]       NVARCHAR(16)  NOT NULL,
        [public_key]      NVARCHAR(MAX) NOT NULL,
        [private_key_enc] NVARCHAR(MAX) NOT NULL,
        [status]          NVARCHAR(16)  NOT NULL DEFAULT 'active',
        [rotated_at]      DATETIME2,
        [expires_at]      DATETIME2,
        [created_at]      DATETIME2     NOT NULL DEFAULT GETDATE(),
        CONSTRAINT fk_jwks_tenant FOREIGN KEY ([tenant_id])
          REFERENCES [tenant]([id]) ON DELETE NO ACTION
      );
    `);
    this.addSql(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_jwks_tenant_status' AND object_id = OBJECT_ID('[jwks_key]'))
        CREATE INDEX idx_jwks_tenant_status ON [jwks_key] ([tenant_id], [status]);
    `);

    // --------------------------------------------------------- tenant_client
    this.addSql(`
      IF OBJECT_ID(N'dbo.[tenant_client]', N'U') IS NULL
      CREATE TABLE [tenant_client] (
        [id]         BIGINT    NOT NULL IDENTITY(1,1) PRIMARY KEY,
        [tenant_id]  BIGINT    NOT NULL,
        [client_id]  BIGINT    NOT NULL,
        [enabled]    BIT       NOT NULL DEFAULT 1,
        [created_at] DATETIME2,
        [updated_at] DATETIME2,
        CONSTRAINT uk_tc UNIQUE ([tenant_id], [client_id]),
        CONSTRAINT fk_tncl_tenant FOREIGN KEY ([tenant_id])
          REFERENCES [tenant]([id]) ON DELETE NO ACTION,
        CONSTRAINT fk_tncl_client FOREIGN KEY ([client_id])
          REFERENCES [client]([id]) ON DELETE NO ACTION
      );
    `);

    // -------------------------------------------------- client_auth_policy
    this.addSql(`
      IF OBJECT_ID(N'dbo.[client_auth_policy]', N'U') IS NULL
      CREATE TABLE [client_auth_policy] (
        [id]                       BIGINT        NOT NULL IDENTITY(1,1) PRIMARY KEY,
        [tenant_id]                BIGINT        NOT NULL,
        [client_id]                BIGINT        NOT NULL,
        [allowed_auth_methods]     NVARCHAR(MAX) NOT NULL DEFAULT '["password"]',
        [default_acr]              NVARCHAR(128) NOT NULL DEFAULT 'urn:auth:pwd',
        [mfa_required]             BIT           NOT NULL DEFAULT 0,
        [allowed_mfa_methods]      NVARCHAR(MAX) NOT NULL DEFAULT '["totp"]',
        [max_session_duration_sec] INT,
        [consent_required]         BIT           NOT NULL DEFAULT 1,
        [require_auth_time]        BIT           NOT NULL DEFAULT 0,
        [created_at]               DATETIME2,
        [updated_at]               DATETIME2,
        CONSTRAINT uk_client_auth_policy_client UNIQUE ([client_id]),
        CONSTRAINT fk_cap_tenant FOREIGN KEY ([tenant_id])
          REFERENCES [tenant]([id]) ON DELETE NO ACTION,
        CONSTRAINT fk_cap_client FOREIGN KEY ([client_id])
          REFERENCES [client]([id]) ON DELETE NO ACTION
      );
    `);

    // -------------------------------------------------------- user_credential
    this.addSql(`
      IF OBJECT_ID(N'dbo.[user_credential]', N'U') IS NULL
      CREATE TABLE [user_credential] (
        [id]           BIGINT       NOT NULL IDENTITY(1,1) PRIMARY KEY,
        [user_id]      CHAR(26)     NOT NULL,
        [type]         NVARCHAR(20) NOT NULL,
        [secret_hash]  NVARCHAR(255) NOT NULL,
        [hash_alg]     NVARCHAR(64),
        [hash_params]  NVARCHAR(MAX),
        [hash_version] INT,
        [enabled]      BIT          NOT NULL DEFAULT 1,
        [expires_at]   DATETIME2,
        [created_at]   DATETIME2,
        [updated_at]   DATETIME2,
        CONSTRAINT fk_ucred_user FOREIGN KEY ([user_id])
          REFERENCES [user]([id]) ON DELETE CASCADE
      );
    `);
    this.addSql(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_ucred_user_type' AND object_id = OBJECT_ID('[user_credential]'))
        CREATE INDEX idx_ucred_user_type ON [user_credential] ([user_id], [type]);
    `);

    // ------------------------------------------------------------- user_group
    this.addSql(`
      IF OBJECT_ID(N'dbo.[user_group]', N'U') IS NULL
      CREATE TABLE [user_group] (
        [user_id]  CHAR(26) NOT NULL,
        [group_id] BIGINT   NOT NULL,
        CONSTRAINT pk_user_group PRIMARY KEY ([user_id], [group_id]),
        CONSTRAINT fk_ug_user  FOREIGN KEY ([user_id])  REFERENCES [user]([id])  ON DELETE CASCADE,
        CONSTRAINT fk_ug_group FOREIGN KEY ([group_id]) REFERENCES [group]([id]) ON DELETE CASCADE
      );
    `);

    // -------------------------------------------------------------- user_role
    this.addSql(`
      IF OBJECT_ID(N'dbo.[user_role]', N'U') IS NULL
      CREATE TABLE [user_role] (
        [user_id]   CHAR(26) NOT NULL,
        [role_id]   BIGINT   NOT NULL,
        [client_id] BIGINT,
        CONSTRAINT pk_user_role PRIMARY KEY ([user_id], [role_id]),
        CONSTRAINT uk_user_role_user_role_client UNIQUE ([user_id], [role_id], [client_id]),
        CONSTRAINT fk_ur_user   FOREIGN KEY ([user_id])   REFERENCES [user]([id])   ON DELETE CASCADE,
        CONSTRAINT fk_ur_role   FOREIGN KEY ([role_id])   REFERENCES [role]([id])   ON DELETE NO ACTION,
        CONSTRAINT fk_ur_client FOREIGN KEY ([client_id]) REFERENCES [client]([id]) ON DELETE NO ACTION
      );
    `);

    // ---------------------------------------------------------- user_identity
    this.addSql(`
      IF OBJECT_ID(N'dbo.[user_identity]', N'U') IS NULL
      CREATE TABLE [user_identity] (
        [id]           BIGINT        NOT NULL IDENTITY(1,1) PRIMARY KEY,
        [tenant_id]    BIGINT        NOT NULL,
        [user_id]      CHAR(26)      NOT NULL,
        [provider]     NVARCHAR(20)  NOT NULL,
        [provider_sub] NVARCHAR(191) NOT NULL,
        [email]        NVARCHAR(191),
        [profile_json] NVARCHAR(MAX),
        [linked_at]    DATETIME2     NOT NULL DEFAULT GETDATE(),
        [created_at]   DATETIME2,
        [updated_at]   DATETIME2,
        CONSTRAINT uk_user_identity UNIQUE ([tenant_id], [provider], [provider_sub]),
        CONSTRAINT fk_ui_tenant FOREIGN KEY ([tenant_id]) REFERENCES [tenant]([id]) ON DELETE NO ACTION,
        CONSTRAINT fk_ui_user   FOREIGN KEY ([user_id])   REFERENCES [user]([id])   ON DELETE CASCADE
      );
    `);
    this.addSql(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_ui_provider_sub' AND object_id = OBJECT_ID('[user_identity]'))
        CREATE INDEX idx_ui_provider_sub ON [user_identity] ([provider_sub]);
    `);

    // ------------------------------------------------------------- group_role
    this.addSql(`
      IF OBJECT_ID(N'dbo.[group_role]', N'U') IS NULL
      CREATE TABLE [group_role] (
        [grp_id]    BIGINT NOT NULL,
        [role_id]   BIGINT NOT NULL,
        [client_id] BIGINT,
        CONSTRAINT pk_group_role PRIMARY KEY ([grp_id], [role_id]),
        CONSTRAINT uk_group_role_group_role_client UNIQUE ([grp_id], [role_id], [client_id]),
        CONSTRAINT fk_gr_group  FOREIGN KEY ([grp_id])    REFERENCES [group]([id])  ON DELETE CASCADE,
        CONSTRAINT fk_gr_role   FOREIGN KEY ([role_id])   REFERENCES [role]([id])   ON DELETE NO ACTION,
        CONSTRAINT fk_gr_client FOREIGN KEY ([client_id]) REFERENCES [client]([id]) ON DELETE NO ACTION
      );
    `);

    // --------------------------------------------------------- role_permission
    this.addSql(`
      IF OBJECT_ID(N'dbo.[role_permission]', N'U') IS NULL
      CREATE TABLE [role_permission] (
        [role_id]       BIGINT NOT NULL,
        [permission_id] BIGINT NOT NULL,
        CONSTRAINT pk_role_permission PRIMARY KEY ([role_id], [permission_id]),
        CONSTRAINT fk_rp_role       FOREIGN KEY ([role_id])       REFERENCES [role]([id])       ON DELETE CASCADE,
        CONSTRAINT fk_rp_permission FOREIGN KEY ([permission_id]) REFERENCES [permission]([id]) ON DELETE CASCADE
      );
    `);

    // ----------------------------------------------------------- role_inherit
    this.addSql(`
      IF OBJECT_ID(N'dbo.[role_inherit]', N'U') IS NULL
      CREATE TABLE [role_inherit] (
        [parent_role_id] BIGINT NOT NULL,
        [child_role_id]  BIGINT NOT NULL,
        CONSTRAINT pk_role_inherit PRIMARY KEY ([parent_role_id], [child_role_id]),
        CONSTRAINT chk_ri_diff CHECK ([parent_role_id] <> [child_role_id]),
        CONSTRAINT fk_ri_parent FOREIGN KEY ([parent_role_id]) REFERENCES [role]([id]) ON DELETE NO ACTION,
        CONSTRAINT fk_ri_child  FOREIGN KEY ([child_role_id])  REFERENCES [role]([id]) ON DELETE NO ACTION
      );
    `);

    // --------------------------------------------------------------- consent
    this.addSql(`
      IF OBJECT_ID(N'dbo.[consent]', N'U') IS NULL
      CREATE TABLE [consent] (
        [id]             BIGINT        NOT NULL IDENTITY(1,1) PRIMARY KEY,
        [tenant_id]      BIGINT        NOT NULL,
        [user_id]        CHAR(26)      NOT NULL,
        [client_id]      BIGINT        NOT NULL,
        [granted_scopes] NVARCHAR(512) NOT NULL,
        [granted_at]     DATETIME2     NOT NULL DEFAULT GETDATE(),
        [revoked_at]     DATETIME2,
        CONSTRAINT uk_consent_tenant_user_client UNIQUE ([tenant_id], [user_id], [client_id]),
        CONSTRAINT fk_consent_tenant FOREIGN KEY ([tenant_id]) REFERENCES [tenant]([id]) ON DELETE NO ACTION,
        CONSTRAINT fk_consent_user   FOREIGN KEY ([user_id])   REFERENCES [user]([id])   ON DELETE NO ACTION,
        CONSTRAINT fk_consent_client FOREIGN KEY ([client_id]) REFERENCES [client]([id]) ON DELETE NO ACTION
      );
    `);

    // --------------------------------------------------------------- event
    this.addSql(`
      IF OBJECT_ID(N'dbo.[event]', N'U') IS NULL
      CREATE TABLE [event] (
        [id]            BIGINT        NOT NULL IDENTITY(1,1) PRIMARY KEY,
        [tenant_id]     BIGINT        NOT NULL,
        [user_id]       CHAR(26),
        [client_id]     BIGINT,
        [category]      NVARCHAR(20)  NOT NULL,
        [severity]      NVARCHAR(20)  NOT NULL,
        [action]        NVARCHAR(20)  NOT NULL,
        [resource_type] NVARCHAR(64),
        [resource_id]   NVARCHAR(191),
        [success]       BIT           NOT NULL DEFAULT 1,
        [reason]        NVARCHAR(255),
        [ip]            VARBINARY(MAX),
        [user_agent]    NVARCHAR(255),
        [metadata]      NVARCHAR(MAX),
        [occurred_at]   DATETIME2     NOT NULL DEFAULT GETDATE(),
        CONSTRAINT fk_event_tenant FOREIGN KEY ([tenant_id]) REFERENCES [tenant]([id]) ON DELETE NO ACTION,
        CONSTRAINT fk_event_user   FOREIGN KEY ([user_id])   REFERENCES [user]([id])   ON DELETE NO ACTION,
        CONSTRAINT fk_event_client FOREIGN KEY ([client_id]) REFERENCES [client]([id]) ON DELETE NO ACTION
      );
    `);
    this.addSql(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_event_tenant_time' AND object_id = OBJECT_ID('[event]'))
        CREATE INDEX idx_event_tenant_time   ON [event] ([tenant_id], [occurred_at]);
    `);
    this.addSql(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_event_category_time' AND object_id = OBJECT_ID('[event]'))
        CREATE INDEX idx_event_category_time ON [event] ([category], [occurred_at]);
    `);
    this.addSql(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_event_user_time' AND object_id = OBJECT_ID('[event]'))
        CREATE INDEX idx_event_user_time     ON [event] ([user_id], [occurred_at]);
    `);
    this.addSql(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_event_client_time' AND object_id = OBJECT_ID('[event]'))
        CREATE INDEX idx_event_client_time   ON [event] ([client_id], [occurred_at]);
    `);
    this.addSql(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_event_action_time' AND object_id = OBJECT_ID('[event]'))
        CREATE INDEX idx_event_action_time   ON [event] ([action], [occurred_at]);
    `);

    // ------------------------------------------------------------- otp_token
    this.addSql(`
      IF OBJECT_ID(N'dbo.[otp_token]', N'U') IS NULL
      CREATE TABLE [otp_token] (
        [id]          CHAR(26)      NOT NULL PRIMARY KEY,
        [tenant_id]   NVARCHAR(64)  NOT NULL,
        [user_id]     CHAR(26)      NOT NULL,
        [purpose]     NVARCHAR(32)  NOT NULL,
        [request_id]  CHAR(26)      NOT NULL,
        [token_hash]  NVARCHAR(128) NOT NULL,
        [issued_at]   DATETIMEOFFSET NOT NULL,
        [expires_at]  DATETIMEOFFSET NOT NULL,
        [consumed_at] DATETIMEOFFSET,
        [created_at]  DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT uk_otp_token_request_id UNIQUE ([request_id])
      );
    `);
    this.addSql(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_otp_tenant_user_purpose' AND object_id = OBJECT_ID('[otp_token]'))
        CREATE INDEX idx_otp_tenant_user_purpose ON [otp_token] ([tenant_id], [user_id], [purpose]);
    `);
    this.addSql(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_otp_expires_at' AND object_id = OBJECT_ID('[otp_token]'))
        CREATE INDEX idx_otp_expires_at ON [otp_token] ([expires_at]);
    `);

    // ------------------------------------------------------------ oidc_model
    this.addSql(`
      IF OBJECT_ID(N'dbo.[oidc_model]', N'U') IS NULL
      CREATE TABLE [oidc_model] (
        [id]          NVARCHAR(128) NOT NULL PRIMARY KEY,
        [kind]        NVARCHAR(64)  NOT NULL,
        [payload]     NVARCHAR(MAX) NOT NULL,
        [uid]         NVARCHAR(128),
        [grant_id]    NVARCHAR(128),
        [user_code]   NVARCHAR(128),
        [consumed_at] DATETIME2,
        [expires_at]  DATETIME2,
        [created_at]  DATETIME2     NOT NULL DEFAULT GETDATE()
      );
    `);
    this.addSql(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_oidc_model_kind_uid' AND object_id = OBJECT_ID('[oidc_model]'))
        CREATE INDEX idx_oidc_model_kind_uid      ON [oidc_model] ([kind], [uid]);
    `);
    this.addSql(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_oidc_model_kind_grant' AND object_id = OBJECT_ID('[oidc_model]'))
        CREATE INDEX idx_oidc_model_kind_grant    ON [oidc_model] ([kind], [grant_id]);
    `);
    this.addSql(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_oidc_model_kind_usercode' AND object_id = OBJECT_ID('[oidc_model]'))
        CREATE INDEX idx_oidc_model_kind_usercode ON [oidc_model] ([kind], [user_code]);
    `);
  }

  async down(): Promise<void> {
    const tables = [
      'oidc_model', 'otp_token', 'event', 'consent',
      'role_inherit', 'role_permission', 'group_role',
      'user_identity', 'user_role', 'user_group', 'user_credential',
      'client_auth_policy', 'tenant_client', 'jwks_key', 'identity_provider',
      'client', 'permission', 'role', '[group]', '[user]',
      'tenant_config', 'tenant',
    ];
    for (const t of tables) {
      this.addSql(`IF OBJECT_ID(N'dbo.${t}', N'U') IS NOT NULL DROP TABLE ${t};`);
    }
  }
}
