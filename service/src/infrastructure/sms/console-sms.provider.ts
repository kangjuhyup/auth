import { Injectable, Logger } from '@nestjs/common';
import type { SmsProviderPort, SmsMessage } from '@application/ports/sms.port';

@Injectable()
export class ConsoleSmsProvider implements SmsProviderPort {
  private readonly logger = new Logger(ConsoleSmsProvider.name);

  async send(message: SmsMessage): Promise<void> {
    this.logger.log(
      `[SMS] tenant=${message.tenantId} to=${message.to} text=${message.text}`,
    );
  }
}
