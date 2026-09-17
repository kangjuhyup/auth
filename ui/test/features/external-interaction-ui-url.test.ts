import { describe, expect, it } from 'vitest';
import { validateExternalInteractionUiUrl } from '@/features/clients/externalInteractionUiUrl';

describe('external interaction UI URL validation', () => {
  it.each([
    'https://login.example.com/interaction',
    'https://login.example.com/interaction?theme=dark',
    'http://localhost:4100/interaction',
    'http://127.0.0.1:4100/interaction',
  ])('허용 가능한 URL을 통과시킨다: %s', (url) => {
    expect(validateExternalInteractionUiUrl(url)).toBeNull();
  });

  it.each([
    'relative/path',
    'http://login.example.com/interaction',
    'https://user:password@login.example.com/interaction',
    'https://*.example.com/interaction',
    'https://login.example.com/interaction#fragment',
  ])('안전하지 않은 URL을 거부한다: %s', (url) => {
    expect(validateExternalInteractionUiUrl(url)).not.toBeNull();
  });
});
