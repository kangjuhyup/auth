import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  NotificationPort,
  type NotificationChannelPort,
} from '@application/ports/notification.port';
import { NotificationService } from './notification.service';
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
      provide: NotificationPort,
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
  ],
  exports: [NotificationPort, SmsProviderPort],
})
export class NotificationModule {}
