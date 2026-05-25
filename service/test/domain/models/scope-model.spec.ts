import {
  ScopeModel,
  isValidScopeToken,
  normalizeScopeString,
  parseScopeString,
} from '@domain/models/scope';

function makeScope(): ScopeModel {
  return new ScopeModel({
    tenantId: 'tenant-1',
    name: 'orders:read',
    displayName: 'Read orders',
    description: null,
    claimKeys: ['profile'],
    enabled: true,
    builtIn: false,
  });
}

describe('ScopeModel', () => {
  it('기본 속성으로 scope를 생성한다', () => {
    const scope = makeScope();

    expect(scope.tenantId).toBe('tenant-1');
    expect(scope.name).toBe('orders:read');
    expect(scope.displayName).toBe('Read orders');
    expect(scope.claimKeys).toEqual(['profile']);
    expect(scope.enabled).toBe(true);
    expect(scope.builtIn).toBe(false);
  });

  it('claim key 변경 시 중복을 제거한다', () => {
    const scope = makeScope();

    scope.changeClaimKeys(['email', 'profile', 'email']);

    expect(scope.claimKeys).toEqual(['email', 'profile']);
  });

  it('scope 문자열을 공백 기준으로 정규화하고 중복을 제거한다', () => {
    expect(parseScopeString('openid  profile email profile')).toEqual([
      'openid',
      'profile',
      'email',
    ]);
    expect(normalizeScopeString('openid  profile email profile')).toBe(
      'openid profile email',
    );
  });

  it('scope token 형식을 검증한다', () => {
    expect(isValidScopeToken('orders:read')).toBe(true);
    expect(isValidScopeToken('profile.email')).toBe(true);
    expect(isValidScopeToken('*admin')).toBe(false);
    expect(isValidScopeToken('')).toBe(false);
  });
});
