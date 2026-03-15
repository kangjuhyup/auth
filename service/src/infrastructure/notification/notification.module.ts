import { Module } from '@nestjs/common';
import {
  NOTIFICATION_PORT,
  NotificationMessage,
} from '@application/ports/notification.port';
import { NotificationService } from '@application/services/notification.service';
import { SmsChannel } from './channels/sms.channel';
import { SMS_PROVIDER } from '@application/ports/sms.port';
import { ConsoleSmsProvider } from '../sms/console-sms.provider';

@Module({
  providers: [
    // Channels
    SmsChannel,

    // SMS Provider (기본 Console)
    {
      provide: SMS_PROVIDER,
      useClass: ConsoleSmsProvider,
    },

    // NotificationService with channels injected
    {
      provide: NotificationService,
      useFactory: (smsChannel: SmsChannel) => {
        const channels = [smsChannel];
        return new NotificationService(channels);
      },
      inject: [SmsChannel],
    },

    // NotificationPort export
    {
      provide: NOTIFICATION_PORT,
      useFactory: (svc: NotificationService) => ({
        notify: (m: NotificationMessage) => svc.notify(m),
      }),
      inject: [NotificationService],
    },
  ],
  exports: [NOTIFICATION_PORT, SMS_PROVIDER],
})
export class NotificationModule {}
