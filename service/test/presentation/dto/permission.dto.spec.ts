import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreatePermissionDto, UpdatePermissionDto } from '@presentation/dto/admin/permission.dto';

async function getErrors(DtoClass: any, plain: object) {
  const instance = plainToInstance(DtoClass, plain);
  return validate(instance as object);
}

describe('CreatePermissionDto', () => {
  const valid = { code: 'user:read' };

  it('유효한 값이면 에러 없음', async () => {
    expect(await getErrors(CreatePermissionDto, valid)).toHaveLength(0);
  });

  it('code 누락 시 에러', async () => {
    const errors = await getErrors(CreatePermissionDto, {});
    expect(errors.some((e) => e.property === 'code')).toBe(true);
  });

  it('code에 허용되지 않는 문자 포함 시 에러', async () => {
    const errors = await getErrors(CreatePermissionDto, { code: 'user read!' });
    expect(errors.some((e) => e.property === 'code')).toBe(true);
  });

  it('code 129자 초과면 에러', async () => {
    const errors = await getErrors(CreatePermissionDto, { code: 'a'.repeat(129) });
    expect(errors.some((e) => e.property === 'code')).toBe(true);
  });

  it('resource 256자 초과면 에러', async () => {
    const errors = await getErrors(CreatePermissionDto, { ...valid, resource: 'r'.repeat(257) });
    expect(errors.some((e) => e.property === 'resource')).toBe(true);
  });

  it('action이 허용된 형식이면 에러 없음', async () => {
    expect(await getErrors(CreatePermissionDto, { ...valid, action: 'read' })).toHaveLength(0);
  });

  it('action이 와일드카드(*)이면 에러 없음', async () => {
    expect(await getErrors(CreatePermissionDto, { ...valid, action: '*' })).toHaveLength(0);
  });

  it('action에 허용되지 않는 문자 포함 시 에러', async () => {
    const errors = await getErrors(CreatePermissionDto, { ...valid, action: 'read all!' });
    expect(errors.some((e) => e.property === 'action')).toBe(true);
  });

  it('action 65자 초과면 에러', async () => {
    const errors = await getErrors(CreatePermissionDto, { ...valid, action: 'a'.repeat(65) });
    expect(errors.some((e) => e.property === 'action')).toBe(true);
  });

  it('description 512자 초과면 에러', async () => {
    const errors = await getErrors(CreatePermissionDto, { ...valid, description: 'd'.repeat(513) });
    expect(errors.some((e) => e.property === 'description')).toBe(true);
  });
});

describe('UpdatePermissionDto', () => {
  it('빈 객체도 에러 없음', async () => {
    expect(await getErrors(UpdatePermissionDto, {})).toHaveLength(0);
  });

  it('action에 허용되지 않는 문자 포함 시 에러', async () => {
    const errors = await getErrors(UpdatePermissionDto, { action: 'delete all!' });
    expect(errors.some((e) => e.property === 'action')).toBe(true);
  });

  it('resource 256자 초과면 에러', async () => {
    const errors = await getErrors(UpdatePermissionDto, { resource: 'r'.repeat(257) });
    expect(errors.some((e) => e.property === 'resource')).toBe(true);
  });
});
