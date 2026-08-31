import { DomainError } from '@domain/errors';

export class ResourceOrigin {
  private constructor(public readonly value: string) {}

  static of(resource: string): ResourceOrigin {
    let url: URL;
    try {
      url = new URL(resource);
    } catch {
      throw new DomainError('InvalidResourceOrigin');
    }

    const host = url.hostname.toLowerCase();
    if (
      url.protocol !== 'https:' ||
      host === 'localhost' ||
      host.endsWith('.local')
    ) {
      throw new DomainError('InvalidResourceOrigin');
    }

    return new ResourceOrigin(url.origin);
  }
}
