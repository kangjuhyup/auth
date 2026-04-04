import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  NotificationPort,
  NotificationMessage,
} from '@application/ports/notification.port';
import { NotificationService, NotificationChannelPort } from '@application/services/notification.service';
import { SmsChannel } from './channels/sms.channel';
import { SmtpEmailChannel } from './channels/smtp-email.channel';
import { SmsProviderPort } from '@application/ports/sms.port';
import { ConsoleSmsProvider } from '../sms/console-sms.provider';

@Module({
  providers: [
    SmsChannel,
    SmtpEmailChannel,

    {
      provide: SmsProviderPort,
      useClass: ConsoleSmsProvider,
    },

    {
      provide: NotificationService,
      useFactory: (
        smsChannel: SmsChannel,
        emailChannel: SmtpEmailChannel,
        config: ConfigService,
      ) => {
        const channels: NotificationChannelPort[] = [smsChannel];

        const smtpHost = config.get<string>('SMTP_HOST');
        if (smtpHost) {
          channels.push(emailChannel);
        }

        return new NotificationService(channels);
      },
      inject: [SmsChannel, SmtpEmailChannel, ConfigService],
    },

    {
      provide: NotificationPort,
      useFactory: (svc: NotificationService) => ({
        notify: (m: NotificationMessage) => svc.notify(m),
      }),
      inject: [NotificationService],
    },
  ],
  exports: [NotificationPort, SmsProviderPort],
})
export class NotificationModule {}
