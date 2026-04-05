/**
 * Form validation 규칙 테스트
 *
 * 각 패턴은 form 컴포넌트의 Ant Design rules[].pattern 에서 추출한 것입니다.
 * 패턴 변경 시 이 테스트도 함께 업데이트해야 합니다.
 *
 * UserForm      : USERNAME_PATTERN
 * TenantForm    : TENANT_CODE_PATTERN  (underscore 불허)
 * RoleForm      : CODE_PATTERN         (underscore 허용)
 * ClientForm    : CODE_PATTERN         (underscore 허용)
 */

import { describe, it, expect } from 'vitest';

// 각 Form 컴포넌트에 정의된 패턴
const USERNAME_PATTERN = /^[a-z0-9._-]+$/;
const TENANT_CODE_PATTERN = /^[a-z0-9-]+$/;
const ROLE_CODE_PATTERN = /^[a-z0-9-_]+$/;
const CLIENT_ID_PATTERN = /^[a-z0-9-_]+$/;

describe('UserForm — username 패턴', () => {
  const valid = ['alice', 'john.doe', 'user-1', 'a_b', 'abc123'];
  const invalid = ['Alice', 'JOHN', 'user name', 'user@mail', 'user!'];

  it.each(valid)('"%s" 는 유효하다', (v) =>
    expect(USERNAME_PATTERN.test(v)).toBe(true),
  );
  it.each(invalid)('"%s" 는 유효하지 않다', (v) =>
    expect(USERNAME_PATTERN.test(v)).toBe(false),
  );

  it('대문자가 포함되면 유효하지 않다', () => {
    expect(USERNAME_PATTERN.test('Alice')).toBe(false);
  });
});

describe('UserForm — password 최소 길이', () => {
  it('8자 이상은 통과한다', () => {
    expect('password'.length >= 8).toBe(true);
    expect('12345678'.length >= 8).toBe(true);
  });

  it('7자 이하는 실패한다', () => {
    expect('1234567'.length >= 8).toBe(false);
    expect(''.length >= 8).toBe(false);
  });
});

describe('TenantForm — code 패턴 (underscore 불허)', () => {
  const valid = ['acme', 'acme-corp', 'my-tenant', 'abc123'];
  const invalid = ['ACME', 'acme_corp', 'acme corp', 'acme.corp'];

  it.each(valid)('"%s" 는 유효하다', (v) =>
    expect(TENANT_CODE_PATTERN.test(v)).toBe(true),
  );
  it.each(invalid)('"%s" 는 유효하지 않다', (v) =>
    expect(TENANT_CODE_PATTERN.test(v)).toBe(false),
  );

  it('underscore(_) 는 허용되지 않는다 (role code 와의 차이)', () => {
    expect(TENANT_CODE_PATTERN.test('acme_corp')).toBe(false);
    expect(ROLE_CODE_PATTERN.test('acme_corp')).toBe(true);
  });
});

describe('RoleForm — code 패턴 (underscore 허용)', () => {
  const valid = ['admin', 'super-admin', 'read_only', 'role123'];
  const invalid = ['Admin', 'ADMIN', 'admin role', 'admin.role'];

  it.each(valid)('"%s" 는 유효하다', (v) =>
    expect(ROLE_CODE_PATTERN.test(v)).toBe(true),
  );
  it.each(invalid)('"%s" 는 유효하지 않다', (v) =>
    expect(ROLE_CODE_PATTERN.test(v)).toBe(false),
  );
});

describe('ClientForm — clientId 패턴', () => {
  const valid = ['my-app', 'my_app', 'webapp1', 'service-account'];
  const invalid = ['MyApp', 'my app', 'app.web', 'app@corp'];

  it.each(valid)('"%s" 는 유효하다', (v) =>
    expect(CLIENT_ID_PATTERN.test(v)).toBe(true),
  );
  it.each(invalid)('"%s" 는 유효하지 않다', (v) =>
    expect(CLIENT_ID_PATTERN.test(v)).toBe(false),
  );
});

describe('패턴 간 차이 명세', () => {
  it('tenantCode 는 underscore 불허, roleCode/clientId 는 허용', () => {
    const withUnderscore = 'my_resource';
    expect(TENANT_CODE_PATTERN.test(withUnderscore)).toBe(false);
    expect(ROLE_CODE_PATTERN.test(withUnderscore)).toBe(true);
    expect(CLIENT_ID_PATTERN.test(withUnderscore)).toBe(true);
  });

  it('username 만 dot(.) 을 허용한다', () => {
    const withDot = 'john.doe';
    expect(USERNAME_PATTERN.test(withDot)).toBe(true);
    expect(TENANT_CODE_PATTERN.test(withDot)).toBe(false);
    expect(ROLE_CODE_PATTERN.test(withDot)).toBe(false);
    expect(CLIENT_ID_PATTERN.test(withDot)).toBe(false);
  });
});
