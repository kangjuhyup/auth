import { Migration } from '@mikro-orm/migrations';
import * as argon2 from 'argon2';
import { ulid } from 'ulid';

/**
 * 기본 시드 데이터
 *  - master 테넌트
 *  - admin 계정 (ADMIN_USERNAME / ADMIN_PASSWORD env 값 사용)
 *  - SUPER_ADMIN 역할 생성 및 admin에게 부여
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
      INSERT INTO [tenant] (code, name, created_at, updated_at)
      VALUES ('master', 'Master', GETDATE(), GETDATE());
    `);

    // 2. master 테넌트 설정
    this.addSql(`
      INSERT INTO [tenant_config] (tenant_id, signup_policy, require_phone_verify)
      SELECT id, 'invite', 0
      FROM [tenant]
      WHERE code = 'master';
    `);

    // 3. admin 사용자
    this.addSql(`
      INSERT INTO [user]
        (id, tenant_id, username, email, email_verified, phone_verified, status, created_at, updated_at)
      SELECT
        '${adminId}', id, '${username}', 'admin@localhost', 1, 0, 'ACTIVE', GETDATE(), GETDATE()
      FROM [tenant]
      WHERE code = 'master';
    `);

    // 4. admin 비밀번호 자격증명 (argon2id, 초기 비밀번호: Admin1234!)
    this.addSql(`
      INSERT INTO [user_credential]
        (user_id, type, secret_hash, hash_alg, hash_params, enabled, created_at, updated_at)
      VALUES
        ('${adminId}', 'password', '${passwordHash}', 'argon2id', '{}', 1, GETDATE(), GETDATE());
    `);

    // 5. SUPER_ADMIN 역할
    this.addSql(`
      INSERT INTO [role] (tenant_id, code, name, description, created_at, updated_at)
      SELECT id, 'SUPER_ADMIN', 'Super Admin', N'플랫폼 최고 관리자', GETDATE(), GETDATE()
      FROM [tenant]
      WHERE code = 'master';
    `);

    // 6. admin 사용자에게 SUPER_ADMIN 역할 부여
    this.addSql(`
      INSERT INTO [user_role] (user_id, role_id)
      SELECT '${adminId}', r.id
      FROM [role] r
      JOIN [tenant] t ON r.tenant_id = t.id
      WHERE t.code = 'master' AND r.code = 'SUPER_ADMIN';
    `);

    // 7. admin portal 시스템 클라이언트
    this.addSql(`
      INSERT INTO [client]
        (tenant_id, client_id, name, type, enabled,
         redirect_uris, grant_types, response_types,
         token_endpoint_auth_method, scope,
         post_logout_redirect_uris, application_type,
         skip_consent, created_at, updated_at)
      SELECT
        id, '__admin-portal__', N'Admin Portal', 'confidential', 1,
        '["${adminUiUrl}/admin/tenants"]', '["authorization_code"]', '["code"]',
        'none', 'openid profile',
        '["${adminUiUrl}/login"]', 'web',
        1, GETDATE(), GETDATE()
      FROM [tenant]
      WHERE code = 'master';
    `);
  }

  async down(): Promise<void> {
    this.addSql(`
      DELETE ur FROM [user_role] ur
      JOIN [user] u ON ur.user_id = u.id
      JOIN [tenant] t ON u.tenant_id = t.id
      WHERE t.code = 'master' AND u.username = '${process.env.ADMIN_USERNAME ?? 'admin'}';
    `);
    this.addSql(`
      DELETE uc FROM [user_credential] uc
      JOIN [user] u ON uc.user_id = u.id
      JOIN [tenant] t ON u.tenant_id = t.id
      WHERE t.code = 'master' AND u.username = '${process.env.ADMIN_USERNAME ?? 'admin'}';
    `);
    this.addSql(`
      DELETE u FROM [user] u
      JOIN [tenant] t ON u.tenant_id = t.id
      WHERE t.code = 'master' AND u.username = '${process.env.ADMIN_USERNAME ?? 'admin'}';
    `);
    this.addSql(`
      DELETE r FROM [role] r
      JOIN [tenant] t ON r.tenant_id = t.id
      WHERE t.code = 'master' AND r.code = 'SUPER_ADMIN';
    `);
    this.addSql(`
      DELETE tc FROM [tenant_config] tc
      JOIN [tenant] t ON tc.tenant_id = t.id
      WHERE t.code = 'master';
    `);
    this.addSql(`
      DELETE c FROM [client] c
      JOIN [tenant] t ON c.tenant_id = t.id
      WHERE c.client_id = '__admin-portal__' AND t.code = 'master';
    `);
    this.addSql(`DELETE FROM [tenant] WHERE code = 'master';`);
  }
}
