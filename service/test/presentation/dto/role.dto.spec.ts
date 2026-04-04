import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateRoleDto, UpdateRoleDto } from '@presentation/dto/admin/role.dto';

async function getErrors(DtoClass: any, plain: object) {
  const instance = plainToInstance(DtoClass, plain);
  return validate(instance as object);
}

describe('CreateRoleDto', () => {
  const valid = { code: 'ADMIN:READ', name: 'Admin Read' };

  it('유효한 값이면 에러 없음', async () => {
    expect(await getErrors(CreateRoleDto, valid)).toHaveLength(0);
  });

  it('code 누락 시 에러', async () => {
    const errors = await getErrors(CreateRoleDto, { ...valid, code: undefined });
    expect(errors.some((e) => e.property === 'code')).toBe(true);
  });

  it('code에 허용되지 않는 문자 포함 시 에러', async () => {
    const errors = await getErrors(CreateRoleDto, { ...valid, code: 'admin role!' });
    expect(errors.some((e) => e.property === 'code')).toBe(true);
  });

  it('code 65자 초과면 에러', async () => {
    const errors = await getErrors(CreateRoleDto, { ...valid, code: 'a'.repeat(65) });
    expect(errors.some((e) => e.property === 'code')).toBe(true);
  });

  it('name 누락 시 에러', async () => {
    const errors = await getErrors(CreateRoleDto, { ...valid, name: undefined });
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('name 빈 문자열이면 에러', async () => {
    const errors = await getErrors(CreateRoleDto, { ...valid, name: '' });
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('description 512자 초과면 에러', async () => {
    const errors = await getErrors(CreateRoleDto, { ...valid, description: 'd'.repeat(513) });
    expect(errors.some((e) => e.property === 'description')).toBe(true);
  });

  it('description 선택 필드이므로 없어도 에러 없음', async () => {
    expect(await getErrors(CreateRoleDto, valid)).toHaveLength(0);
  });
});

describe('UpdateRoleDto', () => {
  it('빈 객체도 에러 없음', async () => {
    expect(await getErrors(UpdateRoleDto, {})).toHaveLength(0);
  });

  it('name 빈 문자열이면 에러', async () => {
    const errors = await getErrors(UpdateRoleDto, { name: '' });
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('description 512자 초과면 에러', async () => {
    const errors = await getErrors(UpdateRoleDto, { description: 'd'.repeat(513) });
    expect(errors.some((e) => e.property === 'description')).toBe(true);
  });
});
