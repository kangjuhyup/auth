import { Module } from '@nestjs/common';
import { SmtpEmailChannel } from '../notification/channels/smtp-email.channel';

@Module({
  providers: [SmtpEmailChannel],
  exports: [SmtpEmailChannel],
})
export class SmtpModule {}
