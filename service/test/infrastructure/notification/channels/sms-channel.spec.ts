import { SmsChannel } from '@infrastructure/notification/channels/sms.channel';
import type { SmsProviderPort } from '@application/ports/sms.port';

describe('SmsChannel', () => {
  let smsProvider: jest.Mocked<SmsProviderPort>;
  let channel: SmsChannel;

  beforeEach(() => {
    smsProvider = { send: jest.fn().mockResolvedValue(undefined) };
    channel = new SmsChannel(smsProvider);
  });

  it('channel은 "sms"', () => {
    expect(channel.channel).toBe('sms');
  });

  it('to.phone 없음 → sms.send 호출 없음', async () => {
    await channel.send({
      tenantId: 'tenant-1',
      to: { email: 'user@example.com' },
      template: 'auth.otp',
      channels: ['sms'],
    });

    expect(smsProvider.send).not.toHaveBeenCalled();
  });

  it('to.phone 있음 → sms.send 호출', async () => {
    await channel.send({
      tenantId: 'tenant-1',
      to: { phone: '+821012345678' },
      template: 'auth.otp',
      channels: ['sms'],
    });

    expect(smsProvider.send).toHaveBeenCalledTimes(1);
    const call = smsProvider.send.mock.calls[0][0];
    expect(call.tenantId).toBe('tenant-1');
    expect(call.to).toBe('+821012345678');
  });

  it('correlationId가 sms.send에 전달된다', async () => {
    await channel.send({
      tenantId: 'tenant-1',
      to: { phone: '+821012345678' },
      template: 'auth.otp',
      channels: ['sms'],
      correlationId: 'corr-123',
    });

    const call = smsProvider.send.mock.calls[0][0];
    expect(call.correlationId).toBe('corr-123');
  });

  it('data가 text에 포함된다', async () => {
    await channel.send({
      tenantId: 'tenant-1',
      to: { phone: '+821012345678' },
      template: 'auth.otp',
      channels: ['sms'],
      data: { code: '123456' },
    });

    const call = smsProvider.send.mock.calls[0][0];
    expect(call.text).toContain('auth.otp');
    expect(call.text).toContain('123456');
  });

  it('data 없으면 빈 객체로 직렬화', async () => {
    await channel.send({
      tenantId: 'tenant-1',
      to: { phone: '+821012345678' },
      template: 'auth.otp',
      channels: ['sms'],
    });

    const call = smsProvider.send.mock.calls[0][0];
    expect(call.text).toContain('{}');
  });
});
