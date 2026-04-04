import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  SignupDto,
  WithdrawDto,
  ChangePasswordDto,
  PasswordResetRequestDto,
  PasswordResetDto,
  UpdateProfileDto,
} from '@presentation/dto/auth/auth.dto';

async function getErrors(DtoClass: any, plain: object) {
  const instance = plainToInstance(DtoClass, plain);
  return validate(instance as object);
}

describe('SignupDto', () => {
  const valid = { username: 'alice', password: 'Passw0rd!' };

  it('유효한 값이면 에러 없음', async () => {
    expect(await getErrors(SignupDto, valid)).toHaveLength(0);
  });

  it('username 누락 시 에러', async () => {
    const errors = await getErrors(SignupDto, { ...valid, username: undefined });
    expect(errors.some((e) => e.property === 'username')).toBe(true);
  });

  it('username 2자 이하면 에러 (minLength=3)', async () => {
    const errors = await getErrors(SignupDto, { ...valid, username: 'ab' });
    expect(errors.some((e) => e.property === 'username')).toBe(true);
  });

  it('username 65자 초과면 에러 (maxLength=64)', async () => {
    const errors = await getErrors(SignupDto, { ...valid, username: 'a'.repeat(65) });
    expect(errors.some((e) => e.property === 'username')).toBe(true);
  });

  it('username에 허용되지 않는 문자 포함 시 에러', async () => {
    const errors = await getErrors(SignupDto, { ...valid, username: 'alice!' });
    expect(errors.some((e) => e.property === 'username')).toBe(true);
  });

  it('password 누락 시 에러', async () => {
    const errors = await getErrors(SignupDto, { ...valid, password: undefined });
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('password 7자 이하면 에러 (minLength=8)', async () => {
    const errors = await getErrors(SignupDto, { ...valid, password: 'short1!' });
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('유효한 email 허용', async () => {
    const errors = await getErrors(SignupDto, { ...valid, email: 'user@example.com' });
    expect(errors).toHaveLength(0);
  });

  it('잘못된 email 형식이면 에러', async () => {
    const errors = await getErrors(SignupDto, { ...valid, email: 'not-an-email' });
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('유효한 phone 허용', async () => {
    const errors = await getErrors(SignupDto, { ...valid, phone: '+821012345678' });
    expect(errors).toHaveLength(0);
  });

  it('잘못된 phone 형식이면 에러', async () => {
    const errors = await getErrors(SignupDto, { ...valid, phone: 'abc-1234' });
    expect(errors.some((e) => e.property === 'phone')).toBe(true);
  });

  it('알 수 없는 필드가 있어도 검증 통과 (whitelist는 파이프에서 처리)', async () => {
    // validate()는 추가 필드를 무시함 — whitelist 제거는 ValidationPipe에서 수행
    const errors = await getErrors(SignupDto, { ...valid, extra: 'x' });
    expect(errors).toHaveLength(0);
  });
});

describe('WithdrawDto', () => {
  it('유효한 값이면 에러 없음', async () => {
    expect(await getErrors(WithdrawDto, { password: 'Passw0rd!' })).toHaveLength(0);
  });

  it('password 누락 시 에러', async () => {
    const errors = await getErrors(WithdrawDto, {});
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('password 7자 이하면 에러', async () => {
    const errors = await getErrors(WithdrawDto, { password: 'short1!' });
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });
});

describe('ChangePasswordDto', () => {
  const valid = { currentPassword: 'OldPass1!', newPassword: 'NewPass1!' };

  it('유효한 값이면 에러 없음', async () => {
    expect(await getErrors(ChangePasswordDto, valid)).toHaveLength(0);
  });

  it('currentPassword 누락 시 에러', async () => {
    const errors = await getErrors(ChangePasswordDto, { ...valid, currentPassword: undefined });
    expect(errors.some((e) => e.property === 'currentPassword')).toBe(true);
  });

  it('newPassword 누락 시 에러', async () => {
    const errors = await getErrors(ChangePasswordDto, { ...valid, newPassword: undefined });
    expect(errors.some((e) => e.property === 'newPassword')).toBe(true);
  });

  it('newPassword 7자 이하면 에러', async () => {
    const errors = await getErrors(ChangePasswordDto, { ...valid, newPassword: 'short1!' });
    expect(errors.some((e) => e.property === 'newPassword')).toBe(true);
  });
});

describe('PasswordResetRequestDto', () => {
  it('email, phone 모두 없어도 에러 없음 (선택 필드)', async () => {
    expect(await getErrors(PasswordResetRequestDto, {})).toHaveLength(0);
  });

  it('유효한 email이면 에러 없음', async () => {
    expect(await getErrors(PasswordResetRequestDto, { email: 'user@example.com' })).toHaveLength(0);
  });

  it('잘못된 email 형식이면 에러', async () => {
    const errors = await getErrors(PasswordResetRequestDto, { email: 'bad-email' });
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('유효한 phone이면 에러 없음', async () => {
    expect(await getErrors(PasswordResetRequestDto, { phone: '+821012345678' })).toHaveLength(0);
  });

  it('잘못된 phone이면 에러', async () => {
    const errors = await getErrors(PasswordResetRequestDto, { phone: 'invalid' });
    expect(errors.some((e) => e.property === 'phone')).toBe(true);
  });
});

describe('PasswordResetDto', () => {
  const valid = { token: 'a'.repeat(32), newPassword: 'NewPass1!' };

  it('유효한 값이면 에러 없음', async () => {
    expect(await getErrors(PasswordResetDto, valid)).toHaveLength(0);
  });

  it('token 누락 시 에러', async () => {
    const errors = await getErrors(PasswordResetDto, { ...valid, token: undefined });
    expect(errors.some((e) => e.property === 'token')).toBe(true);
  });

  it('newPassword 7자 이하면 에러', async () => {
    const errors = await getErrors(PasswordResetDto, { ...valid, newPassword: 'short1!' });
    expect(errors.some((e) => e.property === 'newPassword')).toBe(true);
  });
});

describe('UpdateProfileDto', () => {
  it('빈 객체도 에러 없음 (모두 선택 필드)', async () => {
    expect(await getErrors(UpdateProfileDto, {})).toHaveLength(0);
  });

  it('유효한 email이면 에러 없음', async () => {
    expect(await getErrors(UpdateProfileDto, { email: 'new@example.com' })).toHaveLength(0);
  });

  it('잘못된 email이면 에러', async () => {
    const errors = await getErrors(UpdateProfileDto, { email: 'bad' });
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('유효한 phone이면 에러 없음', async () => {
    expect(await getErrors(UpdateProfileDto, { phone: '01012345678' })).toHaveLength(0);
  });

  it('잘못된 phone이면 에러', async () => {
    const errors = await getErrors(UpdateProfileDto, { phone: 'abc' });
    expect(errors.some((e) => e.property === 'phone')).toBe(true);
  });
});
