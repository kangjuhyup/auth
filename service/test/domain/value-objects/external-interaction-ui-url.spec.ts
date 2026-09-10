import { ExternalInteractionUiUrl } from '@domain/value-objects/external-interaction-ui-url';

describe('ExternalInteractionUiUrl', () => {
  it('절대 HTTPS URL을 정규화하고 exact origin을 제공한다', () => {
    const url = ExternalInteractionUiUrl.of(
      'https://login.example.com/oidc/interaction?theme=dark',
      { allowHttpLocalhost: false },
    );

    expect(url.value).toBe(
      'https://login.example.com/oidc/interaction?theme=dark',
    );
    expect(url.origin).toBe('https://login.example.com');
  });

  it.each([
    'not-a-url',
    '/relative',
    'http://login.example.com',
    'https://user:password@login.example.com',
    'https://login.example.com/#fragment',
    'https://login.example.com/#',
    'https://*.example.com/login',
  ])('안전하지 않은 외부 UI URL %s 를 거부한다', (candidate) => {
    expect(() =>
      ExternalInteractionUiUrl.of(candidate, { allowHttpLocalhost: false }),
    ).toThrow('InvalidExternalInteractionUiUrl');
  });

  it.each([
    'http://localhost:5173/login',
    'http://127.0.0.1:5173/login',
    'http://[::1]:5173/login',
  ])('명시적 개발 정책에서만 loopback HTTP URL %s 를 허용한다', (url) => {
    expect(
      ExternalInteractionUiUrl.of(url, { allowHttpLocalhost: true }).value,
    ).toBe(url);
    expect(() =>
      ExternalInteractionUiUrl.of(url, { allowHttpLocalhost: false }),
    ).toThrow('InvalidExternalInteractionUiUrl');
  });
});
