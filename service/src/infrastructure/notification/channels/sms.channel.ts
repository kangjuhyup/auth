import { Inject, Injectable } from '@nestjs/common';
import type { NotificationMessage } from '@application/ports/notification.port';
import type { NotificationChannelPort } from '@application/services/notification.service';
import {
  SMS_PROVIDER,
  type SmsProviderPort,
} from '@application/ports/sms.port';

@Injectable()
export class SmsChannel implements NotificationChannelPort {
  readonly channel = 'sms' as const;

  constructor(@Inject(SMS_PROVIDER) private readonly sms: SmsProviderPort) {}

  async send(msg: NotificationMessage): Promise<void> {
    const to = msg.to.phone;
    if (!to) return;

    // 템플릿 렌더링(단순 예시)
    const text = `${msg.template} ${JSON.stringify(msg.data ?? {})}`;

    await this.sms.send({
      tenantId: msg.tenantId,
      to,
      text,
      correlationId: msg.correlationId,
    });
  }
}
