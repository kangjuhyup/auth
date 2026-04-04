import { Migration } from '@mikro-orm/migrations';
import * as argon2 from 'argon2';
import { ulid } from 'ulid';

/**
 * 기본 시드 데이터
 *  - master 테넌트
 *  - admin 계정 (초기 비밀번호: Admin1234!)
 *  - SUPER_ADMIN 역할 생성 및 admin에게 부여
 *
 * 운영 환경에서는 배포 후 반드시 admin 비밀번호를 변경하세요.
 */
export class Migration20260404000001 extends Migration {
  override async up(): Promise<void> {
    const adminId = ulid();
    const passwordHash = await argon2.hash('Admin1234!');

    // 1. master 테넌트
    this.addSql(`
      INSERT INTO "tenant" (code, name, created_at, updated_at)
      VALUES ('master', 'Master', NOW(), NOW());
    `);

    // 2. master 테넌트 설정 (가입 정책: invite — 내부 전용)
    this.addSql(`
      INSERT INTO "tenant_config" (tenant_id, signup_policy, require_phone_verify)
      SELECT id, 'invite', false
      FROM "tenant"
      WHERE code = 'master';
    `);

    // 3. admin 사용자
    this.addSql(`
      INSERT INTO "user"
        (id, tenant_id, username, email, email_verified, phone_verified, status, created_at, updated_at)
      SELECT
        '${adminId}', id, 'admin', 'admin@localhost', true, false, 'ACTIVE', NOW(), NOW()
      FROM "tenant"
      WHERE code = 'master';
    `);

    // 4. admin 비밀번호 자격증명 (argon2id, 초기 비밀번호: Admin1234!)
    this.addSql(`
      INSERT INTO "user_credential"
        (user_id, type, secret_hash, hash_alg, hash_params, enabled, created_at, updated_at)
      VALUES
        ('${adminId}', 'password', '${passwordHash}', 'argon2id', '{}', true, NOW(), NOW());
    `);

    // 5. SUPER_ADMIN 역할
    this.addSql(`
      INSERT INTO "role" (tenant_id, code, name, description, created_at, updated_at)
      SELECT id, 'SUPER_ADMIN', 'Super Admin', '플랫폼 최고 관리자', NOW(), NOW()
      FROM "tenant"
      WHERE code = 'master';
    `);

    // 6. admin 사용자에게 SUPER_ADMIN 역할 부여
    this.addSql(`
      INSERT INTO "user_role" (user_id, role_id)
      SELECT '${adminId}', r.id
      FROM "role" r
      JOIN "tenant" t ON r.tenant_id = t.id
      WHERE t.code = 'master' AND r.code = 'SUPER_ADMIN';
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`
      DELETE FROM "user_role"
      WHERE user_id IN (
        SELECT u.id FROM "user" u
        JOIN "tenant" t ON u.tenant_id = t.id
        WHERE t.code = 'master' AND u.username = 'admin'
      );
    `);
    this.addSql(`
      DELETE FROM "user_credential"
      WHERE user_id IN (
        SELECT u.id FROM "user" u
        JOIN "tenant" t ON u.tenant_id = t.id
        WHERE t.code = 'master' AND u.username = 'admin'
      );
    `);
    this.addSql(`
      DELETE FROM "user"
      WHERE username = 'admin'
        AND tenant_id = (SELECT id FROM "tenant" WHERE code = 'master');
    `);
    this.addSql(`
      DELETE FROM "role"
      WHERE code = 'SUPER_ADMIN'
        AND tenant_id = (SELECT id FROM "tenant" WHERE code = 'master');
    `);
    this.addSql(`
      DELETE FROM "tenant_config"
      WHERE tenant_id = (SELECT id FROM "tenant" WHERE code = 'master');
    `);
    this.addSql(`DELETE FROM "tenant" WHERE code = 'master';`);
  }
}
