const LOCAL_HTTP_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function canonicalizeAdminUiUrl(value: string): string | null {
  if (value.trim() !== value || value === '') {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }

  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    (parsed.protocol === 'http:' && !LOCAL_HTTP_HOSTS.has(parsed.hostname)) ||
    parsed.username !== '' ||
    parsed.password !== '' ||
    parsed.search !== '' ||
    parsed.hash !== ''
  ) {
    return null;
  }

  const normalizedPath = parsed.pathname.replace(/\/+$/, '');
  return `${parsed.origin}${normalizedPath}`;
}
