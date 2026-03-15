import type Provider from 'oidc-provider';

type OidcProviderModule = typeof import('oidc-provider');
type OidcProviderConstructor = OidcProviderModule['default'];

let providerConstructorPromise: Promise<OidcProviderConstructor> | undefined;

function importOidcProviderModule(): Promise<OidcProviderModule> {
  // Preserve native dynamic import at runtime for the ESM-only package.
  return new Function(
    'specifier',
    'return import(specifier)',
  )('oidc-provider') as Promise<OidcProviderModule>;
}

export async function loadOidcProviderConstructor(): Promise<
  typeof Provider
> {
  providerConstructorPromise ??= importOidcProviderModule().then(
    (module) => module.default,
  );

  try {
    return await providerConstructorPromise;
  } catch (error) {
    providerConstructorPromise = undefined;
    throw error;
  }
}
