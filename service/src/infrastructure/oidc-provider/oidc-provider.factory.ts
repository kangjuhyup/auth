import Provider from 'oidc-provider';
import { buildOidcConfiguration } from './oidc-provider.config';

export function createOidcProvider(issuer: string): Provider {
  const configuration = buildOidcConfiguration();
  return new Provider(issuer, configuration);
}
