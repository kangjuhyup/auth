import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateTenantPoliciesDto } from '@presentation/dto/admin/policy.dto';

async function getErrors(plain: object) {
  const instance = plainToInstance(UpdateTenantPoliciesDto, plain);
  return validate(instance);
}

describe('UpdateTenantPoliciesDto', () => {
  it('tenant 정책 patch가 유효하면 에러 없음', async () => {
    const errors = await getErrors({
      password: {
        minLength: 14,
        requireUppercase: true,
        preventReuseCount: 10,
        expiresInDays: null,
      },
      mfa: { required: true, adminRequired: true },
      allowedIdp: { providerKeys: ['google', 'okta-workforce'] },
      session: {
        maxAgeSec: 7200,
        requireAuthTime: true,
        reauthenticationIntervalSec: 1800,
      },
      refreshToken: { ttlSec: 604800, rotationEnabled: true },
      signup: {
        mode: 'invite',
        allowedEmailDomains: ['example.com'],
      },
    });

    expect(errors).toHaveLength(0);
  });

  it('password minLength가 너무 짧으면 에러', async () => {
    const errors = await getErrors({ password: { minLength: 4 } });

    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('provider key에 공백이 있으면 에러', async () => {
    const errors = await getErrors({
      allowedIdp: { providerKeys: ['bad provider'] },
    });

    expect(errors.some((e) => e.property === 'allowedIdp')).toBe(true);
  });

  it('refresh token TTL은 60초 이상이어야 한다', async () => {
    const errors = await getErrors({ refreshToken: { ttlSec: 30 } });

    expect(errors.some((e) => e.property === 'refreshToken')).toBe(true);
  });
});
