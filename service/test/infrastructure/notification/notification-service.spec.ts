import { NotificationService } from '@infrastructure/notification/notification.service';
import type { NotificationChannelPort, NotificationMessage } from '@application/ports/notification.port';

function makeMsg(channels: ('email' | 'sms')[]): NotificationMessage {
  return {
    tenantId: 'tenant-1',
    to: { email: 'user@example.com' },
    template: 'auth.password_reset',
    channels,
  };
}

describe('NotificationService', () => {
  it('빈 channels → send 호출 없음', async () => {
    const emailChannel: NotificationChannelPort = { channel: 'email', send: jest.fn() };
    const svc = new NotificationService([emailChannel]);

    await svc.notify(makeMsg([]));

    expect(emailChannel.send).not.toHaveBeenCalled();
  });

  it('등록된 채널 → send 호출', async () => {
    const emailChannel: NotificationChannelPort = { channel: 'email', send: jest.fn().mockResolvedValue(undefined) };
    const svc = new NotificationService([emailChannel]);

    await svc.notify(makeMsg(['email']));

    expect(emailChannel.send).toHaveBeenCalledTimes(1);
  });

  it('미등록 채널(sms) → 스킵', async () => {
    const emailChannel: NotificationChannelPort = { channel: 'email', send: jest.fn() };
    const svc = new NotificationService([emailChannel]);

    await svc.notify(makeMsg(['sms']));

    expect(emailChannel.send).not.toHaveBeenCalled();
  });

  it('두 채널 중 하나 실패해도 나머지는 send 완료 (best-effort)', async () => {
    const emailChannel: NotificationChannelPort = {
      channel: 'email',
      send: jest.fn().mockRejectedValue(new Error('smtp error')),
    };
    const smsChannel: NotificationChannelPort = {
      channel: 'sms',
      send: jest.fn().mockResolvedValue(undefined),
    };
    const svc = new NotificationService([emailChannel, smsChannel]);

    await expect(svc.notify(makeMsg(['email', 'sms']))).resolves.toBeUndefined();

    expect(emailChannel.send).toHaveBeenCalledTimes(1);
    expect(smsChannel.send).toHaveBeenCalledTimes(1);
  });
});
