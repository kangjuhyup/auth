import { Injectable } from '@nestjs/common';
import {
  NotificationPort,
  type NotificationMessage,
  type NotificationChannelPort,
} from '@application/ports/notification.port';

@Injectable()
export class NotificationService extends NotificationPort {
  constructor(private readonly channels: NotificationChannelPort[]) {
    super();
  }

  async notify(msg: NotificationMessage): Promise<void> {
    if (!msg.channels?.length) return;

    const targets = msg.channels
      .map((ch) => this.channels.find((c) => c.channel === ch))
      .filter(Boolean) as NotificationChannelPort[];

    await Promise.allSettled(targets.map((ch) => ch.send(msg)));
  }
}
