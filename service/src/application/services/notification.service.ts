import { Injectable } from '@nestjs/common';
import type {
  NotificationMessage,
  NotificationChannel,
} from '../ports/notification.port';

export interface NotificationChannelPort {
  readonly channel: NotificationChannel;
  send(msg: NotificationMessage): Promise<void>;
}

@Injectable()
export class NotificationService {
  constructor(private readonly channels: NotificationChannelPort[]) {}

  async notify(msg: NotificationMessage): Promise<void> {
    if (!msg.channels?.length) return;

    // 채널별로 “가능한 수신자”가 없으면 스킵
    const targets = msg.channels
      .map((ch) => this.channels.find((c) => c.channel === ch))
      .filter(Boolean) as NotificationChannelPort[];

    // best-effort (한 채널 실패해도 나머지는 시도)
    await Promise.allSettled(targets.map((ch) => ch.send(msg)));
  }
}
