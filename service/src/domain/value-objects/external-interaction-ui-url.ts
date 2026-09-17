import { DomainError } from '@domain/errors';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export class ExternalInteractionUiUrl {
  private constructor(
    public readonly value: string,
    public readonly origin: string,
  ) {}

  static of(
    candidate: string,
    options: { allowHttpLocalhost: boolean },
  ): ExternalInteractionUiUrl {
    let url: URL;
    try {
      url = new URL(candidate);
    } catch {
      throw new DomainError('InvalidExternalInteractionUiUrl');
    }

    const hasForbiddenAuthority = Boolean(url.username || url.password);
    const hasFragment = candidate.includes('#');
    const hasWildcard = url.hostname.includes('*');
    const isSecure = url.protocol === 'https:';
    const isAllowedDevelopmentUrl =
      options.allowHttpLocalhost &&
      url.protocol === 'http:' &&
      LOOPBACK_HOSTS.has(url.hostname.toLowerCase());

    if (
      hasForbiddenAuthority ||
      hasFragment ||
      hasWildcard ||
      (!isSecure && !isAllowedDevelopmentUrl)
    ) {
      throw new DomainError('InvalidExternalInteractionUiUrl');
    }

    return new ExternalInteractionUiUrl(url.toString(), url.origin);
  }
}
