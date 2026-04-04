import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import type { NotificationMessage } from '@application/ports/notification.port';
import type { NotificationChannelPort } from '@application/services/notification.service';

@Injectable()
export class SmtpEmailChannel implements NotificationChannelPort {
  readonly channel = 'email' as const;
  private readonly logger = new Logger(SmtpEmailChannel.name);

  private transporter?: Transporter;
  private from?: string;

  constructor(private readonly configService: ConfigService) {
    const host = configService.get<string>('SMTP_HOST');
    if (host) {
      this.transporter = createTransport({
        host,
        port: Number(configService.get<string>('SMTP_PORT') ?? '587'),
        secure: false,
        auth: {
          user: configService.get<string>('SMTP_USER') ?? '',
          pass: configService.get<string>('SMTP_PASS') ?? '',
        },
      });
      this.from = configService.get<string>('SMTP_FROM') ?? 'noreply@auth.local';
    } else {
      this.logger.warn('SMTP_HOST not configured — email channel disabled');
    }
  }

  async send(msg: NotificationMessage): Promise<void> {
    if (!this.transporter) return;

    const to = msg.to.email;
    if (!to) return;

    const subject = `[${msg.tenantId}] ${msg.template}`;
    const text = JSON.stringify(msg.data ?? {}, null, 2);

    await this.transporter.sendMail({
      from: this.from,
      to,
      subject,
      text,
    });
  }
}
