import { isURL, ValidateBy, type ValidationOptions } from 'class-validator';

/** Registration syntax only. OIDC client/redirect policy stays in oidc-provider. */
export function IsClientRedirectUri(
  options?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isClientRedirectUri',
      validator: {
        validate(value: unknown, args) {
          if (typeof value !== 'string') return false;
          if (isURL(value, { require_tld: false })) return true;
          if (
            (args?.object as { applicationType?: string }).applicationType !==
            'native'
          )
            return false;
          if (/\s/.test(value)) return false;
          try {
            const uri = new URL(value);
            return (
              /^[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+:$/.test(uri.protocol) &&
              uri.pathname.startsWith('/') &&
              uri.pathname.length > 1 &&
              !uri.username &&
              !uri.password &&
              !uri.hash
            );
          } catch {
            return false;
          }
        },
        defaultMessage: () =>
          'each redirect URI must be a URL or a native reverse-domain URI',
      },
    },
    options,
  );
}
