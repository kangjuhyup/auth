jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

import { SmtpEmailChannel } from '@infrastructure/notification/channels/smtp-email.channel';
import { createTransport } from 'nodemailer';

const mockCreateTransport = createTransport as jest.MockedFunction<typeof createTransport>;

function makeConfigService(values: Record<string, string | undefined>) {
  return {
    get: jest.fn((key: string) => values[key]),
  };
}

describe('SmtpEmailChannel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('SMTP_HOST 미설정', () => {
    it('send 호출 시 아무 작업 없이 반환 (transporter 없음)', async () => {
      mockCreateTransport.mockReturnValue(undefined as any);
      const configService = makeConfigService({ SMTP_HOST: undefined });
      const channel = new SmtpEmailChannel(configService as any);

      await expect(
        channel.send({
          tenantId: 'tenant-1',
          to: { email: 'user@example.com' },
          template: 'auth.reset',
          channels: ['email'],
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('SMTP_HOST 설정', () => {
    const mockSendMail = jest.fn().mockResolvedValue({});

    beforeEach(() => {
      mockCreateTransport.mockReturnValue({ sendMail: mockSendMail } as any);
    });

    it('email 없는 msg → sendMail 호출 없음', async () => {
      const configService = makeConfigService({
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: '587',
        SMTP_USER: 'user',
        SMTP_PASS: 'pass',
      });
      const channel = new SmtpEmailChannel(configService as any);

      await channel.send({
        tenantId: 'tenant-1',
        to: {},
        template: 'auth.reset',
        channels: ['email'],
      });

      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('email 있는 msg → sendMail 호출', async () => {
      const configService = makeConfigService({
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: '587',
        SMTP_USER: 'user',
        SMTP_PASS: 'pass',
        SMTP_FROM: 'noreply@auth.local',
      });
      const channel = new SmtpEmailChannel(configService as any);

      await channel.send({
        tenantId: 'tenant-1',
        to: { email: 'user@example.com' },
        template: 'auth.reset',
        channels: ['email'],
      });

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const mailOpts = mockSendMail.mock.calls[0][0];
      expect(mailOpts.to).toBe('user@example.com');
      expect(mailOpts.from).toBe('noreply@auth.local');
      expect(mailOpts.subject).toContain('tenant-1');
      expect(mailOpts.subject).toContain('auth.reset');
    });

    it('SMTP_FROM 미설정 → 기본 발신자 사용', async () => {
      const configService = makeConfigService({
        SMTP_HOST: 'smtp.example.com',
        SMTP_FROM: undefined,
      });
      const channel = new SmtpEmailChannel(configService as any);

      await channel.send({
        tenantId: 'tenant-1',
        to: { email: 'user@example.com' },
        template: 'auth.reset',
        channels: ['email'],
      });

      const mailOpts = mockSendMail.mock.calls[0][0];
      expect(mailOpts.from).toBe('noreply@auth.local');
    });

    it('data가 text에 직렬화된다', async () => {
      const configService = makeConfigService({ SMTP_HOST: 'smtp.example.com' });
      const channel = new SmtpEmailChannel(configService as any);

      await channel.send({
        tenantId: 'tenant-1',
        to: { email: 'user@example.com' },
        template: 'auth.reset',
        channels: ['email'],
        data: { token: 'abc123' },
      });

      const mailOpts = mockSendMail.mock.calls[0][0];
      expect(mailOpts.text).toContain('abc123');
    });
  });
});
