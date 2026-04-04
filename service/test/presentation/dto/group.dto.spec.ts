import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateGroupDto, UpdateGroupDto } from '@presentation/dto/admin/group.dto';

async function getErrors(DtoClass: any, plain: object) {
  const instance = plainToInstance(DtoClass, plain);
  return validate(instance as object);
}

describe('CreateGroupDto', () => {
  const valid = { code: 'engineering', name: 'Engineering' };

  it('유효한 값이면 에러 없음', async () => {
    expect(await getErrors(CreateGroupDto, valid)).toHaveLength(0);
  });

  it('code 누락 시 에러', async () => {
    const errors = await getErrors(CreateGroupDto, { ...valid, code: undefined });
    expect(errors.some((e) => e.property === 'code')).toBe(true);
  });

  it('code에 허용되지 않는 문자 포함 시 에러', async () => {
    const errors = await getErrors(CreateGroupDto, { ...valid, code: 'eng team!' });
    expect(errors.some((e) => e.property === 'code')).toBe(true);
  });

  it('name 누락 시 에러', async () => {
    const errors = await getErrors(CreateGroupDto, { ...valid, name: undefined });
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('name 빈 문자열이면 에러', async () => {
    const errors = await getErrors(CreateGroupDto, { ...valid, name: '' });
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('유효한 UUID parentId이면 에러 없음', async () => {
    expect(
      await getErrors(CreateGroupDto, {
        ...valid,
        parentId: '550e8400-e29b-41d4-a716-446655440000',
      }),
    ).toHaveLength(0);
  });

  it('UUID 형식이 아닌 parentId이면 에러', async () => {
    const errors = await getErrors(CreateGroupDto, { ...valid, parentId: 'not-a-uuid' });
    expect(errors.some((e) => e.property === 'parentId')).toBe(true);
  });
});

describe('UpdateGroupDto', () => {
  it('빈 객체도 에러 없음', async () => {
    expect(await getErrors(UpdateGroupDto, {})).toHaveLength(0);
  });

  it('name 빈 문자열이면 에러', async () => {
    const errors = await getErrors(UpdateGroupDto, { name: '' });
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('parentId null이면 에러 없음 (상위 그룹 해제 의도)', async () => {
    expect(await getErrors(UpdateGroupDto, { parentId: null })).toHaveLength(0);
  });

  it('parentId가 UUID 형식이 아니면 에러', async () => {
    const errors = await getErrors(UpdateGroupDto, { parentId: 'bad-id' });
    expect(errors.some((e) => e.property === 'parentId')).toBe(true);
  });
});
