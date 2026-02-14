export const SMS_PROVIDER = Symbol('SMS_PROVIDER');

export type SmsMessage = Readonly<{
  tenantId: string;
  to: string | string[]; // E.164 권장
  text: string;
  correlationId?: string;
}>;

export interface SmsProviderPort {
  send(message: SmsMessage): Promise<void>;
}
