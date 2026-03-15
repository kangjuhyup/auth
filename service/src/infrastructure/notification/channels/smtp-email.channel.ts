import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import type { NotificationMessage } from '@application/ports/notification.port';
import type { NotificationChannelPort } from '@application/services/notification.service';

@Injectable()
export class SmtpEmailChannel implements NotificationChannelPort {
  readonly channel = 'email' as const;

  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(private readonly configService: ConfigService) {
    this.transporter = createTransport({
      host: configService.getOrThrow<string>('SMTP_HOST'),
      port: Number(configService.getOrThrow<string>('SMTP_PORT')),
      secure: false,
      auth: {
        user: configService.getOrThrow<string>('SMTP_USER'),
        pass: configService.getOrThrow<string>('SMTP_PASS'),
      },
    });
    this.from = configService.getOrThrow<string>('SMTP_FROM');
  }

  async send(msg: NotificationMessage): Promise<void> {
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
