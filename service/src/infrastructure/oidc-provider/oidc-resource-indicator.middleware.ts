import type Provider from 'oidc-provider';
import { ResourceOrigin } from '@domain/value-objects/resource-origin';

export function registerOidcResourceIndicatorNormalization(
  provider: Provider,
): void {
  provider.use(async (ctx: any, next: () => Promise<unknown>) => {
    if (ctx.method === 'GET' && ctx.path === '/auth') {
      const resources = normalizeResourceValues(ctx.query?.resource);
      if (resources) {
        ctx.query.resource = resources.length === 1 ? resources[0] : resources;
      }
    }
    await next();
  });
}

function normalizeResourceValues(value: unknown): string[] | null {
  const resources = Array.isArray(value) ? value : [value];
  if (
    resources.length === 0 ||
    resources.some((resource) => typeof resource !== 'string')
  ) {
    return null;
  }

  try {
    return (resources as string[]).map(
      (resource) => ResourceOrigin.of(resource).value,
    );
  } catch {
    return null;
  }
}
