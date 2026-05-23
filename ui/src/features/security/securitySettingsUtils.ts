import type { IdentityLinkResponse, ProfileResponse } from '@/types/auth.types';

export type ContactVerificationItem = Readonly<{
  key: 'email' | 'phone';
  label: string;
  value: string;
  verified: boolean;
  canRequest: boolean;
}>;

export function getContactVerificationItems(
  profile?: ProfileResponse,
): ContactVerificationItem[] {
  return [
    {
      key: 'email',
      label: 'Email',
      value: profile?.email ?? '',
      verified: profile?.emailVerified ?? false,
      canRequest: Boolean(profile?.email),
    },
    {
      key: 'phone',
      label: 'Phone',
      value: profile?.phone ?? '',
      verified: profile?.phoneVerified ?? false,
      canRequest: Boolean(profile?.phone),
    },
  ];
}

export function formatProviderLabel(provider: string): string {
  return provider
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function hasLinkedIdentities(links?: IdentityLinkResponse[]): boolean {
  return Boolean(links?.length);
}

export function canSubmitTotpCode(code: string): boolean {
  return /^\d{6}$/.test(code.trim());
}
