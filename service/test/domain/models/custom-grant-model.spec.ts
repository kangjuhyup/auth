import {
  CustomGrantModel,
  isValidCustomGrantType,
} from '@domain/models/custom-grant';

function makeGrant(): CustomGrantModel {
  return new CustomGrantModel({
    tenantId: 'tenant-1',
    grantType: 'urn:auth:grant-type:magic_link',
    displayName: 'Magic Link',
    description: null,
    enabled: true,
    allowedClientTypes: ['confidential'],
    allowedApplicationTypes: ['web'],
    requiresClientAuthentication: true,
    requiresGrantTypes: [],
    builtIn: false,
  });
}

describe('CustomGrantModel', () => {
  it('기본 속성으로 custom grant metadata를 생성한다', () => {
    const grant = makeGrant();

    expect(grant.tenantId).toBe('tenant-1');
    expect(grant.grantType).toBe('urn:auth:grant-type:magic_link');
    expect(grant.allowedClientTypes).toEqual(['confidential']);
    expect(grant.requiresClientAuthentication).toBe(true);
  });

  it('중복 정책 배열을 제거한다', () => {
    const grant = makeGrant();

    grant.changeAllowedClientTypes(['confidential', 'confidential']);
    grant.changeRequiresGrantTypes([
      'authorization_code',
      'authorization_code',
    ]);

    expect(grant.allowedClientTypes).toEqual(['confidential']);
    expect(grant.requiresGrantTypes).toEqual(['authorization_code']);
  });

  it('custom grant type은 urn 형식만 허용한다', () => {
    expect(isValidCustomGrantType('urn:auth:grant-type:magic_link')).toBe(true);
    expect(isValidCustomGrantType('authorization_code')).toBe(false);
    expect(isValidCustomGrantType('password')).toBe(false);
  });
});
