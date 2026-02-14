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
    NotificationService,
    SmsChannel,

    // ✅ default SMS provider (OSS 기본 제공)
    {
      provide: SMS_PROVIDER,
      useClass: ConsoleSmsProvider,
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
