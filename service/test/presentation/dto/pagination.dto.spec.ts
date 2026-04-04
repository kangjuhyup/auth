import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { PaginationQuery } from '@presentation/dto/common/pagination.dto';

async function getErrors(plain: object) {
  const instance = plainToInstance(PaginationQuery, plain);
  return validate(instance as object);
}

describe('PaginationQuery', () => {
  it('빈 객체도 에러 없음 (모두 선택 필드)', async () => {
    expect(await getErrors({})).toHaveLength(0);
  });

  it('유효한 page, limit이면 에러 없음', async () => {
    expect(await getErrors({ page: 1, limit: 20 })).toHaveLength(0);
  });

  it('page가 0이면 에러 (min=1)', async () => {
    const errors = await getErrors({ page: 0 });
    expect(errors.some((e) => e.property === 'page')).toBe(true);
  });

  it('page가 음수이면 에러', async () => {
    const errors = await getErrors({ page: -1 });
    expect(errors.some((e) => e.property === 'page')).toBe(true);
  });

  it('page가 소수이면 에러 (isInt)', async () => {
    const errors = await getErrors({ page: 1.5 });
    expect(errors.some((e) => e.property === 'page')).toBe(true);
  });

  it('page 문자열이 숫자로 변환되면 에러 없음 (@Type(() => Number))', async () => {
    // ValidationPipe + transform:true 환경에서 쿼리 파라미터는 문자열로 들어옴
    const instance = plainToInstance(PaginationQuery, { page: '2', limit: '10' });
    const errors = await validate(instance as object);
    expect(errors).toHaveLength(0);
    expect(instance.page).toBe(2);
    expect(instance.limit).toBe(10);
  });

  it('limit이 0이면 에러 (min=1)', async () => {
    const errors = await getErrors({ limit: 0 });
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });

  it('limit이 101이면 에러 (max=100)', async () => {
    const errors = await getErrors({ limit: 101 });
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });

  it('limit이 100이면 에러 없음', async () => {
    expect(await getErrors({ limit: 100 })).toHaveLength(0);
  });
});
