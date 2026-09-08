import { afterEach, describe, expect, it, vi } from 'vitest';
import { readRegistrationHandoffId, submitSignup } from '../../src/api/client';

describe('submitSignup', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('현재 interaction의 signup endpoint에만 credentials를 전송한다', async () => {
    window.history.replaceState({}, '', '/t/acme/interaction/uid-1');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, redirectTo: '/done' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await submitSignup({
      username: 'new-user',
      password: 'Secure123!',
      email: 'new@example.com',
      handoffId: 'handoff-browser-value',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/t/acme/interaction/uid-1/api/signup',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
        body: JSON.stringify({
          username: 'new-user',
          password: 'Secure123!',
          email: 'new@example.com',
          handoffId: 'handoff-browser-value',
        }),
      }),
    );
  });

  it('Account redirect query에서 handoffId만 읽는다', () => {
    expect(
      readRegistrationHandoffId(
        '?handoffId=handoff-browser-value&ticket=must-not-be-used',
      ),
    ).toBe('handoff-browser-value');
    expect(readRegistrationHandoffId('?ticket=raw-ticket')).toBe('');
  });
});
