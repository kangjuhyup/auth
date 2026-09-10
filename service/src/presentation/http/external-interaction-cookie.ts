import type { Request, Response } from 'express';

const TENANT_CODE_PATTERN = /^[a-z0-9-]{1,64}$/;
const UID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

export function externalInteractionBrowserCookieName(tenantCode: string) {
  assertPathParts(tenantCode, 'uid_12345678');
  return `_external_interaction_${tenantCode}`;
}

export function readExternalInteractionBrowserBinding(
  request: Request,
  tenantCode: string,
): string | undefined {
  return readCookie(
    request.headers.cookie,
    externalInteractionBrowserCookieName(tenantCode),
  );
}

export function setExternalInteractionCookies(params: {
  request: Request;
  response: Response;
  tenantCode: string;
  uid: string;
  browserBinding: string;
  maxAgeMs: number;
  secure: boolean;
}): void {
  assertPathParts(params.tenantCode, params.uid);
  const interactionCookieName = `_interaction_${params.tenantCode}`;
  const interactionSignatureName = `${interactionCookieName}.sig`;
  const interactionId = readCookie(
    params.request.headers.cookie,
    interactionCookieName,
  );
  const interactionSignature = readCookie(
    params.request.headers.cookie,
    interactionSignatureName,
  );
  if (interactionId !== params.uid || !interactionSignature) {
    throw new Error('External interaction cookie binding is missing');
  }

  const path = `/t/${params.tenantCode}/interaction/${params.uid}`;
  const options = {
    httpOnly: true,
    secure: params.secure,
    sameSite: params.secure ? ('none' as const) : ('lax' as const),
    path,
    maxAge: params.maxAgeMs,
  };
  params.response.cookie(interactionCookieName, interactionId, options);
  params.response.cookie(
    interactionSignatureName,
    interactionSignature,
    options,
  );
  params.response.cookie(
    externalInteractionBrowserCookieName(params.tenantCode),
    params.browserBinding,
    options,
  );
}

function readCookie(
  header: string | undefined,
  expectedName: string,
): string | undefined {
  if (!header || header.length > 16_384) return undefined;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 1) continue;
    const name = part.slice(0, separator).trim();
    if (name !== expectedName) continue;
    const rawValue = part.slice(separator + 1).trim();
    try {
      return decodeURIComponent(rawValue);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function assertPathParts(tenantCode: string, uid: string): void {
  if (!TENANT_CODE_PATTERN.test(tenantCode) || !UID_PATTERN.test(uid)) {
    throw new Error('Invalid external interaction cookie path');
  }
}
