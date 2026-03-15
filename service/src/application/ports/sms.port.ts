export type SmsMessage = Readonly<{
  tenantId: string;
  to: string | string[]; // E.164 권장
  text: string;
  correlationId?: string;
}>;

export abstract class SmsProviderPort {
  abstract send(message: SmsMessage): Promise<void>;
}
