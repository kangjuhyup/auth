import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateClientDto, UpdateClientDto } from '@presentation/dto/admin/client.dto';

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
    const errors = await getErrors(CreateClientDto, { ...valid, clientId: undefined });
    expect(errors.some((e) => e.property === 'clientId')).toBe(true);
  });

  it('clientId에 허용되지 않는 문자 포함 시 에러', async () => {
    const errors = await getErrors(CreateClientDto, { ...valid, clientId: 'my client!' });
    expect(errors.some((e) => e.property === 'clientId')).toBe(true);
  });

  it('name 누락 시 에러', async () => {
    const errors = await getErrors(CreateClientDto, { ...valid, name: undefined });
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('type이 confidential이면 에러 없음', async () => {
    expect(await getErrors(CreateClientDto, { ...valid, type: 'confidential' })).toHaveLength(0);
  });

  it('type이 허용되지 않는 값이면 에러', async () => {
    const errors = await getErrors(CreateClientDto, { ...valid, type: 'secret' });
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

  it('grantTypes에 허용되지 않는 값이면 에러', async () => {
    const errors = await getErrors(CreateClientDto, {
      ...valid,
      grantTypes: ['password'],
    });
    expect(errors.some((e) => e.property === 'grantTypes')).toBe(true);
  });

  it('tokenEndpointAuthMethod가 허용된 값이면 에러 없음', async () => {
    expect(
      await getErrors(CreateClientDto, { ...valid, tokenEndpointAuthMethod: 'client_secret_basic' }),
    ).toHaveLength(0);
  });

  it('tokenEndpointAuthMethod가 허용되지 않는 값이면 에러', async () => {
    const errors = await getErrors(CreateClientDto, {
      ...valid,
      tokenEndpointAuthMethod: 'basic',
    });
    expect(errors.some((e) => e.property === 'tokenEndpointAuthMethod')).toBe(true);
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
    expect(errors.some((e) => e.property === 'backchannelLogoutUri')).toBe(true);
  });

  it('allowedResources에 https가 아닌 URL이 있으면 에러', async () => {
    const errors = await getErrors(CreateClientDto, {
      ...valid,
      allowedResources: ['http://api.example.com'],
    });
    expect(errors.some((e) => e.property === 'allowedResources')).toBe(true);
  });

  it('applicationType이 web이면 에러 없음', async () => {
    expect(await getErrors(CreateClientDto, { ...valid, applicationType: 'web' })).toHaveLength(0);
  });

  it('applicationType이 허용되지 않는 값이면 에러', async () => {
    const errors = await getErrors(CreateClientDto, { ...valid, applicationType: 'desktop' });
    expect(errors.some((e) => e.property === 'applicationType')).toBe(true);
  });

  it('skipConsent boolean이면 에러 없음', async () => {
    expect(await getErrors(CreateClientDto, { ...valid, skipConsent: true })).toHaveLength(0);
  });

  it('skipConsent 문자열이면 에러', async () => {
    const errors = await getErrors(CreateClientDto, { ...valid, skipConsent: 'yes' });
    expect(errors.some((e) => e.property === 'skipConsent')).toBe(true);
  });
});

describe('UpdateClientDto', () => {
  it('빈 객체도 에러 없음', async () => {
    expect(await getErrors(UpdateClientDto, {})).toHaveLength(0);
  });

  it('enabled boolean이면 에러 없음', async () => {
    expect(await getErrors(UpdateClientDto, { enabled: false })).toHaveLength(0);
  });

  it('secret null이면 에러 없음 (삭제 의도)', async () => {
    expect(await getErrors(UpdateClientDto, { secret: null })).toHaveLength(0);
  });

  it('secret이 32자 미만 문자열이면 에러', async () => {
    const errors = await getErrors(UpdateClientDto, { secret: 'short' });
    expect(errors.some((e) => e.property === 'secret')).toBe(true);
  });

  it('backchannelLogoutUri null이면 에러 없음 (삭제 의도)', async () => {
    expect(await getErrors(UpdateClientDto, { backchannelLogoutUri: null })).toHaveLength(0);
  });

  it('backchannelLogoutUri http이면 에러', async () => {
    const errors = await getErrors(UpdateClientDto, {
      backchannelLogoutUri: 'http://example.com/logout',
    });
    expect(errors.some((e) => e.property === 'backchannelLogoutUri')).toBe(true);
  });

  it('name 빈 문자열이면 에러', async () => {
    const errors = await getErrors(UpdateClientDto, { name: '' });
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });
});
