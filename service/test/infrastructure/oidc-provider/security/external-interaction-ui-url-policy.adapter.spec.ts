import { ExternalInteractionUiUrlPolicyAdapter } from '@infrastructure/oidc-provider/security/external-interaction-ui-url-policy.adapter';

function makeAdapter(values: Record<string, string | undefined>) {
  return new ExternalInteractionUiUrlPolicyAdapter({
    get: jest.fn((key: string, defaultValue?: string) =>
      values[key] === undefined ? defaultValue : values[key],
    ),
  } as any);
}

describe('ExternalInteractionUiUrlPolicyAdapter', () => {
  it('기본 정책은 HTTPS만 허용한다', () => {
    const adapter = makeAdapter({ NODE_ENV: 'development' });

    expect(adapter.normalize('https://ui.example.com/login')).toBe(
      'https://ui.example.com/login',
    );
    expect(() => adapter.normalize('http://localhost:5173/login')).toThrow(
      'InvalidExternalInteractionUiUrl',
    );
  });

  it('비운영 환경의 명시적 flag에서만 localhost HTTP를 허용한다', () => {
    const development = makeAdapter({
      NODE_ENV: 'development',
      EXTERNAL_INTERACTION_UI_ALLOW_HTTP_LOCALHOST: 'true',
    });
    const production = makeAdapter({
      NODE_ENV: 'production',
      EXTERNAL_INTERACTION_UI_ALLOW_HTTP_LOCALHOST: 'true',
    });

    expect(development.normalize('http://localhost:5173/login')).toBe(
      'http://localhost:5173/login',
    );
    expect(() => production.normalize('http://localhost:5173/login')).toThrow(
      'InvalidExternalInteractionUiUrl',
    );
  });
});
