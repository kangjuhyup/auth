import { Injectable } from '@nestjs/common';
import type { NotificationMessage, NotificationChannelPort } from '@application/ports/notification.port';
import { SmsProviderPort } from '@application/ports/sms.port';

@Injectable()
export class SmsChannel implements NotificationChannelPort {
  readonly channel = 'sms' as const;

  constructor(private readonly sms: SmsProviderPort) {}

  async send(msg: NotificationMessage): Promise<void> {
    const to = msg.to.phone;
    if (!to) return;

    const text = `${msg.template} ${JSON.stringify(msg.data ?? {})}`;

    await this.sms.send({
      tenantId: msg.tenantId,
      to,
      text,
      correlationId: msg.correlationId,
    });
  }
}
