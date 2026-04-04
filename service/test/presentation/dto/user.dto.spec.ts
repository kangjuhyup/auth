import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateUserDto, UpdateUserDto } from '@presentation/dto/admin/user.dto';

async function getErrors(DtoClass: any, plain: object) {
  const instance = plainToInstance(DtoClass, plain);
  return validate(instance as object);
}

describe('CreateUserDto', () => {
  const valid = { username: 'alice', password: 'Passw0rd!' };

  it('유효한 값이면 에러 없음', async () => {
    expect(await getErrors(CreateUserDto, valid)).toHaveLength(0);
  });

  it('username 누락 시 에러', async () => {
    const errors = await getErrors(CreateUserDto, { ...valid, username: undefined });
    expect(errors.some((e) => e.property === 'username')).toBe(true);
  });

  it('username 2자 이하면 에러', async () => {
    const errors = await getErrors(CreateUserDto, { ...valid, username: 'ab' });
    expect(errors.some((e) => e.property === 'username')).toBe(true);
  });

  it('username에 공백 포함 시 에러', async () => {
    const errors = await getErrors(CreateUserDto, { ...valid, username: 'ali ce' });
    expect(errors.some((e) => e.property === 'username')).toBe(true);
  });

  it('password 7자 이하면 에러', async () => {
    const errors = await getErrors(CreateUserDto, { ...valid, password: 'short1!' });
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('유효한 email이면 에러 없음', async () => {
    expect(await getErrors(CreateUserDto, { ...valid, email: 'user@example.com' })).toHaveLength(0);
  });

  it('잘못된 email이면 에러', async () => {
    const errors = await getErrors(CreateUserDto, { ...valid, email: 'bad-email' });
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('유효한 phone이면 에러 없음', async () => {
    expect(await getErrors(CreateUserDto, { ...valid, phone: '+821012345678' })).toHaveLength(0);
  });

  it('잘못된 phone이면 에러', async () => {
    const errors = await getErrors(CreateUserDto, { ...valid, phone: 'abc' });
    expect(errors.some((e) => e.property === 'phone')).toBe(true);
  });

  it('status ACTIVE 허용', async () => {
    expect(await getErrors(CreateUserDto, { ...valid, status: 'ACTIVE' })).toHaveLength(0);
  });

  it('status LOCKED 허용', async () => {
    expect(await getErrors(CreateUserDto, { ...valid, status: 'LOCKED' })).toHaveLength(0);
  });

  it('status DISABLED 허용', async () => {
    expect(await getErrors(CreateUserDto, { ...valid, status: 'DISABLED' })).toHaveLength(0);
  });

  it('status 허용되지 않는 값이면 에러', async () => {
    const errors = await getErrors(CreateUserDto, { ...valid, status: 'BANNED' });
    expect(errors.some((e) => e.property === 'status')).toBe(true);
  });
});

describe('UpdateUserDto', () => {
  it('빈 객체도 에러 없음', async () => {
    expect(await getErrors(UpdateUserDto, {})).toHaveLength(0);
  });

  it('email만 수정 가능', async () => {
    expect(await getErrors(UpdateUserDto, { email: 'new@example.com' })).toHaveLength(0);
  });

  it('잘못된 email이면 에러', async () => {
    const errors = await getErrors(UpdateUserDto, { email: 'bad' });
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('status 허용되지 않는 값이면 에러', async () => {
    const errors = await getErrors(UpdateUserDto, { status: 'DELETED' });
    expect(errors.some((e) => e.property === 'status')).toBe(true);
  });
});
