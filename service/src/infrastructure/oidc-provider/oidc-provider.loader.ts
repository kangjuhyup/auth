import type Provider from 'oidc-provider';

type OidcProviderModule = typeof import('oidc-provider');

let providerModulePromise: Promise<OidcProviderModule> | undefined;

function importOidcProviderModule(): Promise<OidcProviderModule> {
  // Preserve native dynamic import at runtime for the ESM-only package.
  return new Function('specifier', 'return import(specifier)')(
    'oidc-provider',
  ) as Promise<OidcProviderModule>;
}

export async function loadOidcProviderConstructor(): Promise<typeof Provider> {
  return (await loadOidcProviderModule()).default;
}

export async function createOidcInvalidGrantError(detail: string) {
  const { errors } = await loadOidcProviderModule();
  return new errors.InvalidGrant(detail);
}

async function loadOidcProviderModule(): Promise<OidcProviderModule> {
  providerModulePromise ??= importOidcProviderModule();

  try {
    return await providerModulePromise;
  } catch (error) {
    providerModulePromise = undefined;
    throw error;
  }
}
