import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExternalInteractionUiUrlPolicyPort } from '@application/ports/external-interaction-ui-url-policy.port';
import { ExternalInteractionUiUrl } from '@domain/value-objects/external-interaction-ui-url';

@Injectable()
export class ExternalInteractionUiUrlPolicyAdapter extends ExternalInteractionUiUrlPolicyPort {
  constructor(private readonly config: ConfigService) {
    super();
  }

  normalize(url: string): string {
    const allowHttpLocalhost =
      this.config.get<string>('NODE_ENV') !== 'production' &&
      this.config.get<string>(
        'EXTERNAL_INTERACTION_UI_ALLOW_HTTP_LOCALHOST',
        'false',
      ) === 'true';

    return ExternalInteractionUiUrl.of(url, { allowHttpLocalhost }).value;
  }
}
