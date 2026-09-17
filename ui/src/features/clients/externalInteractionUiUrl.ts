const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function validateExternalInteractionUiUrl(
  candidate: string | null | undefined,
): string | null {
  const value = candidate?.trim();
  if (!value) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return 'Enter an absolute HTTPS URL';
  }

  if (url.username || url.password) {
    return 'User information is not allowed in the URL';
  }
  if (value.includes('#')) {
    return 'URL fragments are not allowed';
  }
  if (url.hostname.includes('*')) {
    return 'Wildcard hosts are not allowed';
  }

  const isHttps = url.protocol === 'https:';
  const isHttpLoopback =
    url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname.toLowerCase());
  if (!isHttps && !isHttpLoopback) {
    return 'HTTPS is required (HTTP loopback needs the Auth development flag)';
  }

  return null;
}
