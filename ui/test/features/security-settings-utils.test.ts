import { describe, expect, it } from 'vitest';
import {
  canSubmitTotpCode,
  formatProviderLabel,
  getContactVerificationItems,
  hasLinkedIdentities,
} from '../../src/features/security/securitySettingsUtils';

describe('security settings utilities', () => {
  it('builds contact verification state from profile data', () => {
    const items = getContactVerificationItems({
      id: 'user-1',
      username: 'alice',
      email: 'alice@example.com',
      emailVerified: true,
      phone: null,
      phoneVerified: false,
      status: 'active',
    });

    expect(items).toEqual([
      {
        key: 'email',
        label: 'Email',
        value: 'alice@example.com',
        verified: true,
        canRequest: true,
      },
      {
        key: 'phone',
        label: 'Phone',
        value: '',
        verified: false,
        canRequest: false,
      },
    ]);
  });

  it('formats provider ids for display', () => {
    expect(formatProviderLabel('saml-corporate_idp')).toBe(
      'Saml Corporate Idp',
    );
  });

  it('detects linked identities', () => {
    expect(hasLinkedIdentities([])).toBe(false);
    expect(
      hasLinkedIdentities([
        { id: '1', provider: 'google', linkedAt: new Date() },
      ]),
    ).toBe(true);
  });

  it('accepts only 6 digit totp codes', () => {
    expect(canSubmitTotpCode('123456')).toBe(true);
    expect(canSubmitTotpCode(' 123456 ')).toBe(true);
    expect(canSubmitTotpCode('12345')).toBe(false);
    expect(canSubmitTotpCode('abcdef')).toBe(false);
  });
});
