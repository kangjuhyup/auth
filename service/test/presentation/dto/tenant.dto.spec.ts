import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateTenantDto, UpdateTenantDto } from '@presentation/dto/admin/tenant.dto';

async function getErrors(DtoClass: any, plain: object) {
  const instance = plainToInstance(DtoClass, plain);
  return validate(instance as object);
}

describe('CreateTenantDto', () => {
  const valid = { code: 'acme-corp', name: 'Acme Corporation' };

  it('유효한 값이면 에러 없음', async () => {
    expect(await getErrors(CreateTenantDto, valid)).toHaveLength(0);
  });

  it('code 누락 시 에러', async () => {
    const errors = await getErrors(CreateTenantDto, { ...valid, code: undefined });
    expect(errors.some((e) => e.property === 'code')).toBe(true);
  });

  it('code에 대문자 포함 시 에러', async () => {
    const errors = await getErrors(CreateTenantDto, { ...valid, code: 'Acme' });
    expect(errors.some((e) => e.property === 'code')).toBe(true);
  });

  it('code에 특수문자 포함 시 에러', async () => {
    const errors = await getErrors(CreateTenantDto, { ...valid, code: 'acme_corp' });
    expect(errors.some((e) => e.property === 'code')).toBe(true);
  });

  it('code 65자 초과면 에러 (maxLength=64)', async () => {
    const errors = await getErrors(CreateTenantDto, { ...valid, code: 'a'.repeat(65) });
    expect(errors.some((e) => e.property === 'code')).toBe(true);
  });

  it('name 누락 시 에러', async () => {
    const errors = await getErrors(CreateTenantDto, { ...valid, name: undefined });
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('name 빈 문자열이면 에러', async () => {
    const errors = await getErrors(CreateTenantDto, { ...valid, name: '' });
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('signupPolicy가 invite이면 에러 없음', async () => {
    expect(await getErrors(CreateTenantDto, { ...valid, signupPolicy: 'invite' })).toHaveLength(0);
  });

  it('signupPolicy가 open이면 에러 없음', async () => {
    expect(await getErrors(CreateTenantDto, { ...valid, signupPolicy: 'open' })).toHaveLength(0);
  });

  it('signupPolicy가 허용되지 않는 값이면 에러', async () => {
    const errors = await getErrors(CreateTenantDto, { ...valid, signupPolicy: 'public' });
    expect(errors.some((e) => e.property === 'signupPolicy')).toBe(true);
  });

  it('requirePhoneVerify가 boolean이면 에러 없음', async () => {
    expect(await getErrors(CreateTenantDto, { ...valid, requirePhoneVerify: true })).toHaveLength(0);
  });

  it('requirePhoneVerify가 문자열이면 에러', async () => {
    const errors = await getErrors(CreateTenantDto, { ...valid, requirePhoneVerify: 'yes' });
    expect(errors.some((e) => e.property === 'requirePhoneVerify')).toBe(true);
  });

  it('brandName 128자 초과면 에러', async () => {
    const errors = await getErrors(CreateTenantDto, { ...valid, brandName: 'b'.repeat(129) });
    expect(errors.some((e) => e.property === 'brandName')).toBe(true);
  });
});

describe('UpdateTenantDto', () => {
  it('빈 객체도 에러 없음 (모두 선택 필드)', async () => {
    expect(await getErrors(UpdateTenantDto, {})).toHaveLength(0);
  });

  it('name 빈 문자열이면 에러 (isNotEmpty)', async () => {
    const errors = await getErrors(UpdateTenantDto, { name: '' });
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('signupPolicy 허용되지 않는 값이면 에러', async () => {
    const errors = await getErrors(UpdateTenantDto, { signupPolicy: 'closed' });
    expect(errors.some((e) => e.property === 'signupPolicy')).toBe(true);
  });
});
