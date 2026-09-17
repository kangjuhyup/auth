import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ExternalInteractionUiPort } from '@application/ports/external-interaction-ui.port';
import type { ExternalInteractionAccessClaims } from '@application/ports/external-interaction-access.port';
import { readExternalInteractionBrowserBinding } from './external-interaction-cookie';
import type { Request } from 'express';

export type ExternalInteractionRequest = Request & {
  externalInteractionAccess?: ExternalInteractionAccessClaims;
};

@Injectable()
export class ExternalInteractionGuard implements CanActivate {
  constructor(
    private readonly externalInteractionUi: ExternalInteractionUiPort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<ExternalInteractionRequest>();
    const tenantCode = String(request.params?.['tenantCode'] ?? '');
    const uid = String(request.params?.['uid'] ?? '');
    const authorization = request.headers?.authorization;
    const accessToken = readBearer(authorization);
    const csrfHeader = request.headers?.['x-interaction-csrf'];
    const csrfToken = Array.isArray(csrfHeader) ? csrfHeader[0] : csrfHeader;
    const browserBinding = readExternalInteractionBrowserBinding(
      request as any,
      tenantCode,
    );

    const result = await this.externalInteractionUi.authorize({
      tenantCode,
      uid,
      origin: request.headers?.origin,
      accessToken,
      csrfToken,
      browserBinding,
    });
    if (result.mode === 'external') {
      request.externalInteractionAccess = result.access;
    }
    return true;
  }
}

function readBearer(value: string | undefined): string | undefined {
  const match = value?.match(/^Bearer ([A-Za-z0-9._~-]+)$/);
  return match?.[1];
}
