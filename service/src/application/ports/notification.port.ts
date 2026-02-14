export const NOTIFICATION_PORT = Symbol('NOTIFICATION_PORT');

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

  channels: NotificationChannel[]; // 보낼 채널 목록
}>;

export interface NotificationPort {
  notify(msg: NotificationMessage): Promise<void>;
}
