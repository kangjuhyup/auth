import { Module } from '@nestjs/common';
import {
  NotificationPort,
  NotificationMessage,
} from '@application/ports/notification.port';
import { NotificationService } from '@application/services/notification.service';
import { SmsChannel } from './channels/sms.channel';
import { SmsProviderPort } from '@application/ports/sms.port';
import { ConsoleSmsProvider } from '../sms/console-sms.provider';

@Module({
  providers: [
    // Channels
    SmsChannel,

    // SMS Provider (기본 Console)
    {
      provide: SmsProviderPort,
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
