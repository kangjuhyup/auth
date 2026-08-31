import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  CreateClientDto,
  UpdateClientAuthPolicyDto,
  UpdateClientDto,
} from '@presentation/dto/admin/client.dto';

async function getErrors(DtoClass: any, plain: object) {
  const instance = plainToInstance(DtoClass, plain);
  return validate(instance as object);
}

describe('CreateClientDto', () => {
  const valid = { clientId: 'my-client', name: 'My App' };

  it('유효한 값이면 에러 없음', async () => {
    expect(await getErrors(CreateClientDto, valid)).toHaveLength(0);
  });

  it('clientId 누락 시 에러', async () => {
    const errors = await getErrors(CreateClientDto, {
      ...valid,
      clientId: undefined,
    });
    expect(errors.some((e) => e.property === 'clientId')).toBe(true);
  });

  it('clientId에 허용되지 않는 문자 포함 시 에러', async () => {
    const errors = await getErrors(CreateClientDto, {
      ...valid,
      clientId: 'my client!',
    });
    expect(errors.some((e) => e.property === 'clientId')).toBe(true);
  });

  it('name 누락 시 에러', async () => {
    const errors = await getErrors(CreateClientDto, {
      ...valid,
      name: undefined,
    });
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('type이 confidential이면 에러 없음', async () => {
    expect(
      await getErrors(CreateClientDto, { ...valid, type: 'confidential' }),
    ).toHaveLength(0);
  });

  it('type이 허용되지 않는 값이면 에러', async () => {
    const errors = await getErrors(CreateClientDto, {
      ...valid,
      type: 'secret',
    });
    expect(errors.some((e) => e.property === 'type')).toBe(true);
  });

  it('유효한 redirectUris이면 에러 없음', async () => {
    const errors = await getErrors(CreateClientDto, {
      ...valid,
      redirectUris: ['https://example.com/callback'],
    });
    expect(errors).toHaveLength(0);
  });

  it('redirectUris에 유효하지 않은 URL이 있으면 에러', async () => {
    const errors = await getErrors(CreateClientDto, {
      ...valid,
      redirectUris: ['not a url with spaces!'],
    });
    expect(errors.some((e) => e.property === 'redirectUris')).toBe(true);
  });

  it('grantTypes에 허용된 값이면 에러 없음', async () => {
    const errors = await getErrors(CreateClientDto, {
      ...valid,
      grantTypes: ['authorization_code', 'refresh_token'],
    });
    expect(errors).toHaveLength(0);
  });

  it('grantTypes에 urn 형식 custom grant면 에러 없음', async () => {
    const errors = await getErrors(CreateClientDto, {
      ...valid,
      grantTypes: ['urn:auth:grant-type:magic_link'],
    });
    expect(errors).toHaveLength(0);
  });

  it('grantTypes에 허용되지 않는 값이면 에러', async () => {
    const errors = await getErrors(CreateClientDto, {
      ...valid,
      grantTypes: ['password'],
    });
    expect(errors.some((e) => e.property === 'grantTypes')).toBe(true);
  });

  it('tokenEndpointAuthMethod가 허용된 값이면 에러 없음', async () => {
    expect(
      await getErrors(CreateClientDto, {
        ...valid,
        tokenEndpointAuthMethod: 'client_secret_basic',
      }),
    ).toHaveLength(0);
  });

  it('tokenEndpointAuthMethod가 허용되지 않는 값이면 에러', async () => {
    const errors = await getErrors(CreateClientDto, {
      ...valid,
      tokenEndpointAuthMethod: 'basic',
    });
    expect(errors.some((e) => e.property === 'tokenEndpointAuthMethod')).toBe(
      true,
    );
  });

  it('backchannelLogoutUri가 https URL이면 에러 없음', async () => {
    expect(
      await getErrors(CreateClientDto, {
        ...valid,
        backchannelLogoutUri: 'https://example.com/logout',
      }),
    ).toHaveLength(0);
  });

  it('backchannelLogoutUri가 http이면 에러', async () => {
    const errors = await getErrors(CreateClientDto, {
      ...valid,
      backchannelLogoutUri: 'http://example.com/logout',
    });
    expect(errors.some((e) => e.property === 'backchannelLogoutUri')).toBe(
      true,
    );
  });

  it('allowedResources에 https가 아닌 URL이 있으면 에러', async () => {
    const errors = await getErrors(CreateClientDto, {
      ...valid,
      allowedResources: ['http://api.example.com'],
    });
    expect(errors.some((e) => e.property === 'allowedResources')).toBe(true);
  });

  it('introspectionResources는 명시적 HTTPS URL 배열을 허용한다', async () => {
    expect(
      await getErrors(CreateClientDto, {
        ...valid,
        introspectionResources: ['https://api.example.com'],
      }),
    ).toHaveLength(0);
  });

  it.each([
    'http://api.example.com',
    'api.example.com',
    'https:api.example.com',
  ])('introspectionResources의 비 HTTPS 입력 %s를 거부한다', async (resource) => {
    const errors = await getErrors(CreateClientDto, {
      ...valid,
      introspectionResources: [resource],
    });
    expect(
      errors.some((error) => error.property === 'introspectionResources'),
    ).toBe(true);
  });

  it('applicationType이 web이면 에러 없음', async () => {
    expect(
      await getErrors(CreateClientDto, { ...valid, applicationType: 'web' }),
    ).toHaveLength(0);
  });

  it('applicationType이 허용되지 않는 값이면 에러', async () => {
    const errors = await getErrors(CreateClientDto, {
      ...valid,
      applicationType: 'desktop',
    });
    expect(errors.some((e) => e.property === 'applicationType')).toBe(true);
  });

  it('skipConsent boolean이면 에러 없음', async () => {
    expect(
      await getErrors(CreateClientDto, { ...valid, skipConsent: true }),
    ).toHaveLength(0);
  });

  it('skipConsent 문자열이면 에러', async () => {
    const errors = await getErrors(CreateClientDto, {
      ...valid,
      skipConsent: 'yes',
    });
    expect(errors.some((e) => e.property === 'skipConsent')).toBe(true);
  });
});

describe('UpdateClientDto', () => {
  it('빈 객체도 에러 없음', async () => {
    expect(await getErrors(UpdateClientDto, {})).toHaveLength(0);
  });

  it('enabled boolean이면 에러 없음', async () => {
    expect(await getErrors(UpdateClientDto, { enabled: false })).toHaveLength(
      0,
    );
  });

  it('secret null이면 에러 없음 (삭제 의도)', async () => {
    expect(await getErrors(UpdateClientDto, { secret: null })).toHaveLength(0);
  });

  it('secret이 32자 미만 문자열이면 에러', async () => {
    const errors = await getErrors(UpdateClientDto, { secret: 'short' });
    expect(errors.some((e) => e.property === 'secret')).toBe(true);
  });

  it('backchannelLogoutUri null이면 에러 없음 (삭제 의도)', async () => {
    expect(
      await getErrors(UpdateClientDto, { backchannelLogoutUri: null }),
    ).toHaveLength(0);
  });

  it('backchannelLogoutUri http이면 에러', async () => {
    const errors = await getErrors(UpdateClientDto, {
      backchannelLogoutUri: 'http://example.com/logout',
    });
    expect(errors.some((e) => e.property === 'backchannelLogoutUri')).toBe(
      true,
    );
  });

  it('name 빈 문자열이면 에러', async () => {
    const errors = await getErrors(UpdateClientDto, { name: '' });
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('introspectionResources는 명시적 HTTPS URL 배열을 허용한다', async () => {
    expect(
      await getErrors(UpdateClientDto, {
        introspectionResources: ['https://api.example.com'],
      }),
    ).toHaveLength(0);
  });

  it.each([
    'http://api.example.com',
    'api.example.com',
    'https:api.example.com',
  ])('introspectionResources의 비 HTTPS 입력 %s를 거부한다', async (resource) => {
    const errors = await getErrors(UpdateClientDto, {
      introspectionResources: [resource],
    });
    expect(
      errors.some((error) => error.property === 'introspectionResources'),
    ).toBe(true);
  });
});

describe('UpdateClientAuthPolicyDto', () => {
  it('allowedIdpProviderKeys 배열이면 에러 없음', async () => {
    expect(
      await getErrors(UpdateClientAuthPolicyDto, {
        allowedIdpProviderKeys: ['google', 'okta-workforce'],
      }),
    ).toHaveLength(0);
  });

  it('allowedIdpProviderKeys null이면 기본값 사용으로 에러 없음', async () => {
    expect(
      await getErrors(UpdateClientAuthPolicyDto, {
        allowedIdpProviderKeys: null,
      }),
    ).toHaveLength(0);
  });

  it('allowedIdpProviderKeys에 허용되지 않는 문자가 있으면 에러', async () => {
    const errors = await getErrors(UpdateClientAuthPolicyDto, {
      allowedIdpProviderKeys: ['bad provider'],
    });

    expect(errors.some((e) => e.property === 'allowedIdpProviderKeys')).toBe(
      true,
    );
  });

  it('reauthenticationIntervalSec는 60초 이상이어야 한다', async () => {
    const errors = await getErrors(UpdateClientAuthPolicyDto, {
      reauthenticationIntervalSec: 30,
    });

    expect(
      errors.some((e) => e.property === 'reauthenticationIntervalSec'),
    ).toBe(true);
  });

  it('single login override 정책이면 에러 없음', async () => {
    expect(
      await getErrors(UpdateClientAuthPolicyDto, {
        loginSessionMode: 'single',
        maxConcurrentSessions: 1,
        sessionConflictAction: 'deny_new_login',
      }),
    ).toHaveLength(0);
  });

  it('client는 multi login으로 완화할 수 없다', async () => {
    const errors = await getErrors(UpdateClientAuthPolicyDto, {
      loginSessionMode: 'multi',
    });

    expect(errors.some((e) => e.property === 'loginSessionMode')).toBe(true);
  });
});
