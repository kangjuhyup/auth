export type NotificationChannel = 'email' | 'sms';

export type NotificationMessage = Readonly<{
  correlationId?: string;
  tenantId: string;
  userId?: string;

  to: {
    email?: string | string[];
    phone?: string | string[];
  };

  template: string; // ex) 'auth.password_reset'
  data?: Record<string, unknown>;

  channels: NotificationChannel[];
}>;

export interface NotificationChannelPort {
  readonly channel: NotificationChannel;
  send(msg: NotificationMessage): Promise<void>;
}

export abstract class NotificationPort {
  abstract notify(msg: NotificationMessage): Promise<void>;
}
