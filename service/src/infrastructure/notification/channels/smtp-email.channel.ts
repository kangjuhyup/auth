import { Injectable } from '@nestjs/common';
import { createTransport } from 'nodemailer';
import type { NotificationMessage } from '@application/ports/notification.port';
import type { NotificationChannelPort } from '@application/services/notification.service';

@Injectable()
export class SmtpEmailChannel implements NotificationChannelPort {
  readonly channel = 'email' as const;

  private readonly transporter = createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  async send(msg: NotificationMessage): Promise<void> {
    const to = msg.to.email;
    if (!to) return;

    // 템플릿 렌더링은 여기서 단순 처리하거나 별도 TemplateRendererPort로 분리 가능
    const subject = `[${msg.tenantId}] ${msg.template}`;
    const text = JSON.stringify(msg.data ?? {}, null, 2);

    await this.transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      text,
    });
  }
}
