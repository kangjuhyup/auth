import { Migration } from '@mikro-orm/migrations';
import * as argon2 from 'argon2';
import { ulid } from 'ulid';

function sqlLiteral(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "''");
}

/**
 * 기본 시드 데이터
 *  - master 테넌트, admin, SUPER_ADMIN, admin portal 클라이언트
 *  - identity_provider.display_name 보강(레거시) + master용 Google IdP 시드
 *
 * 필수: ADMIN_USERNAME, ADMIN_PASSWORD
 * 선택(IdP): SEED_AUTH_PUBLIC_BASE, SEED_GOOGLE_OIDC_CLIENT_ID, SEED_GOOGLE_OIDC_CLIENT_SECRET
 */
export class Migration20260404000001 extends Migration {
  async up(): Promise<void> {
    const username = process.env.ADMIN_USERNAME;
    const password = process.env.ADMIN_PASSWORD;

    if (!username || !password) {
      throw new Error(
        'Migration requires ADMIN_USERNAME and ADMIN_PASSWORD environment variables',
      );
    }

    const adminUiUrl = process.env.ADMIN_UI_URL ?? 'http://localhost:5173';
    const adminId = ulid();
    const passwordHash = await argon2.hash(password);

    // 1. master 테넌트
    this.addSql(`
      INSERT INTO \`tenant\` (code, name, created_at, updated_at)
      VALUES ('master', 'Master', NOW(), NOW());
    `);

    // 2. master 테넌트 설정
    this.addSql(`
      INSERT INTO \`tenant_config\` (tenant_id, signup_policy, require_phone_verify)
      SELECT id, 'invite', 0
      FROM \`tenant\`
      WHERE code = 'master';
    `);

    // 3. admin 사용자
    this.addSql(`
      INSERT INTO \`user\`
        (id, tenant_id, username, email, email_verified, phone_verified, status, created_at, updated_at)
      SELECT
        '${adminId}', id, '${username}', 'admin@localhost', 1, 0, 'ACTIVE', NOW(), NOW()
      FROM \`tenant\`
      WHERE code = 'master';
    `);

    // 4. admin 비밀번호 자격증명 (argon2id, 초기 비밀번호: Admin1234!)
    this.addSql(`
      INSERT INTO \`user_credential\`
        (user_id, type, secret_hash, hash_alg, hash_params, enabled, created_at, updated_at)
      VALUES
        ('${adminId}', 'password', '${passwordHash}', 'argon2id', '{}', 1, NOW(), NOW());
    `);

    // 5. SUPER_ADMIN 역할
    this.addSql(`
      INSERT INTO \`role\` (tenant_id, code, name, description, created_at, updated_at)
      SELECT id, 'SUPER_ADMIN', 'Super Admin', '플랫폼 최고 관리자', NOW(), NOW()
      FROM \`tenant\`
      WHERE code = 'master';
    `);

    // 6. admin 사용자에게 SUPER_ADMIN 역할 부여
    this.addSql(`
      INSERT INTO \`user_role\` (user_id, role_id)
      SELECT '${adminId}', r.id
      FROM \`role\` r
      JOIN \`tenant\` t ON r.tenant_id = t.id
      WHERE t.code = 'master' AND r.code = 'SUPER_ADMIN';
    `);

    // 7. admin portal 시스템 클라이언트
    this.addSql(`
      INSERT INTO \`client\`
        (tenant_id, client_id, name, type, enabled,
         redirect_uris, grant_types, response_types,
         token_endpoint_auth_method, scope,
         post_logout_redirect_uris, application_type,
         skip_consent, created_at, updated_at)
      SELECT
        id, '__admin-portal__', 'Admin Portal', 'confidential', 1,
        '["${adminUiUrl}/admin/tenants"]', '["authorization_code"]', '["code"]',
        'none', 'openid profile',
        '["${adminUiUrl}/login"]', 'web',
        1, NOW(), NOW()
      FROM \`tenant\`
      WHERE code = 'master';
    `);

    // 8. 레거시: display_name 없을 때만 컬럼 추가 + master Google IdP 시드
    this.addSql(`DROP PROCEDURE IF EXISTS __mikro_add_idp_display_name`);
    this.addSql(`
CREATE PROCEDURE __mikro_add_idp_display_name()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'identity_provider'
      AND COLUMN_NAME = 'display_name'
  ) THEN
    ALTER TABLE \`identity_provider\` ADD COLUMN \`display_name\` VARCHAR(50) NULL;
  END IF;
END
`);
    this.addSql(`CALL __mikro_add_idp_display_name()`);
    this.addSql(`DROP PROCEDURE __mikro_add_idp_display_name`);

    this.addSql(`
      UPDATE \`identity_provider\`
      SET \`display_name\` = CONCAT(
        UPPER(LEFT(\`provider\`, 1)),
        LOWER(SUBSTRING(\`provider\`, 2))
      )
      WHERE \`display_name\` IS NULL OR TRIM(\`display_name\`) = '';
    `);
    this.addSql(`
      ALTER TABLE \`identity_provider\`
      MODIFY \`display_name\` VARCHAR(50) NOT NULL;
    `);

    this.addSql(`DROP PROCEDURE IF EXISTS __mikro_add_idp_oauth_config`);
    this.addSql(`
CREATE PROCEDURE __mikro_add_idp_oauth_config()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'identity_provider'
      AND COLUMN_NAME = 'oauth_config'
  ) THEN
    ALTER TABLE \`identity_provider\` ADD COLUMN \`oauth_config\` JSON NULL;
  END IF;
END
`);
    this.addSql(`CALL __mikro_add_idp_oauth_config()`);
    this.addSql(`DROP PROCEDURE __mikro_add_idp_oauth_config`);

    const googleSeedOauthJson = JSON.stringify({
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      userinfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
      scopes: ['openid', 'email', 'profile'],
      subField: 'sub',
      emailField: 'email',
      extraAuthParams: { prompt: 'select_account' },
    });
    const googOauthSql = sqlLiteral(googleSeedOauthJson);

    const base = (
      process.env.SEED_AUTH_PUBLIC_BASE ?? 'http://localhost:3000'
    ).replace(/\/$/, '');
    const googleClientId = (process.env.SEED_GOOGLE_OIDC_CLIENT_ID ?? '').trim();
    const googleSecret = (process.env.SEED_GOOGLE_OIDC_CLIENT_SECRET ?? '').trim();
    const googleConfigured = Boolean(googleClientId && googleSecret);
    const cid = sqlLiteral(
      googleConfigured ? googleClientId : '__configure_google_client_id__',
    );
    const sec = googleConfigured ? `'${sqlLiteral(googleSecret)}'` : 'NULL';
    const enabled = googleConfigured ? '1' : '0';
    const redirectUri = sqlLiteral(
      `${base}/t/master/interaction/seed/google/callback`,
    );

    this.addSql(`
      INSERT IGNORE INTO \`identity_provider\`
        (tenant_id, provider, display_name, client_id, client_secret, redirect_uri, enabled, oauth_config, created_at, updated_at)
      SELECT
        t.id,
        'google',
        'Google',
        '${cid}',
        ${sec},
        '${redirectUri}',
        ${enabled},
        CAST('${googOauthSql}' AS JSON),
        NOW(),
        NOW()
      FROM \`tenant\` t
      WHERE t.code = 'master';
    `);
    this.addSql(`
      UPDATE \`identity_provider\` ip
      INNER JOIN \`tenant\` t ON ip.tenant_id = t.id
      SET ip.oauth_config = CAST('${googOauthSql}' AS JSON)
      WHERE t.code = 'master'
        AND ip.provider = 'google'
        AND ip.oauth_config IS NULL;
    `);
  }

  async down(): Promise<void> {
    this.addSql(`SET FOREIGN_KEY_CHECKS = 0;`);
    this.addSql(`
      DELETE ur FROM \`user_role\` ur
      JOIN \`user\` u ON ur.user_id = u.id
      JOIN \`tenant\` t ON u.tenant_id = t.id
      WHERE t.code = 'master' AND u.username = '${process.env.ADMIN_USERNAME ?? 'admin'}';
    `);
    this.addSql(`
      DELETE uc FROM \`user_credential\` uc
      JOIN \`user\` u ON uc.user_id = u.id
      JOIN \`tenant\` t ON u.tenant_id = t.id
      WHERE t.code = 'master' AND u.username = '${process.env.ADMIN_USERNAME ?? 'admin'}';
    `);
    this.addSql(`
      DELETE u FROM \`user\` u
      JOIN \`tenant\` t ON u.tenant_id = t.id
      WHERE t.code = 'master' AND u.username = '${process.env.ADMIN_USERNAME ?? 'admin'}';
    `);
    this.addSql(`
      DELETE r FROM \`role\` r
      JOIN \`tenant\` t ON r.tenant_id = t.id
      WHERE t.code = 'master' AND r.code = 'SUPER_ADMIN';
    `);
    this.addSql(`
      DELETE tc FROM \`tenant_config\` tc
      JOIN \`tenant\` t ON tc.tenant_id = t.id
      WHERE t.code = 'master';
    `);
    this.addSql(`
      DELETE c FROM \`client\` c
      JOIN \`tenant\` t ON c.tenant_id = t.id
      WHERE c.client_id = '__admin-portal__' AND t.code = 'master';
    `);
    this.addSql(`
      DELETE ip FROM \`identity_provider\` ip
      JOIN \`tenant\` t ON ip.tenant_id = t.id
      WHERE t.code = 'master';
    `);
    this.addSql(`DELETE FROM \`tenant\` WHERE code = 'master';`);
    this.addSql(`SET FOREIGN_KEY_CHECKS = 1;`);
  }
}
