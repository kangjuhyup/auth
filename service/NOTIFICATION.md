# NOTIFICATION.md
이 문서는 `service/`의 Notification(알림) 모듈 설계 및 확장 가이드를 설명합니다.

Notification 모듈은 **메일(Email), 문자(SMS), 향후 Push/Webhook 등**을
플러그형(교체 가능한 Provider) 구조로 제공합니다.

도메인은 알림을 모릅니다.
알림은 Application Port + Infrastructure Adapter 로만 구현됩니다.

Security correctness > Convenience

---

# 1. 목표

- 하나의 유스케이스에서 다중 채널(email/sms 등) 전송
- 오픈소스 배포 고려: SMS 구현은 사용자마다 다르게 교체 가능
- NestJS DI 기반으로 간단히 Provider 교체 가능
- 멀티테넌트 환경 고려

---

# 2. 아키텍처 개요

Application Layer
  - NotificationPort
  - NotificationService (fan-out 정책)
  - SmsProviderPort (플러그인 포인트)

Infrastructure Layer
  - Email SMTP Channel
  - Sms Channel (SmsProviderPort 사용)
  - Default ConsoleSmsProvider (기본 제공)
  - 사용자 정의 SMS Provider (교체 가능)

---

# 3. 권장 폴더 구조

service/src/

application/
  ports/
    notification.port.ts
    sms.port.ts
  services/
    notification.service.ts

infrastructure/
  notification/
    notification.module.ts
    channels/
      email-smtp.channel.ts
      sms.channel.ts
  sms/
    console-sms.provider.ts

---

# 4. Application Layer

## 4.1 NotificationPort

application/ports/notification.port.ts

```ts
export const NOTIFICATION_PORT = Symbol('NOTIFICATION_PORT');

export type NotificationChannel = 'email' | 'sms';

export type NotificationMessage = Readonly<{
  tenantId: string;
  userId?: string;
  to: {
    email?: string;
    phone?: string;
  };
  template: string;
  data?: Record<string, unknown>;
  channels: NotificationChannel[];
  correlationId?: string;
}>;

export interface NotificationPort {
  notify(message: NotificationMessage): Promise<void>;
}
```

---

## 4.2 SmsProviderPort (플러그인 포인트)

application/ports/sms.port.ts

```ts
export const SMS_PROVIDER = Symbol('SMS_PROVIDER');

export type SmsMessage = Readonly<{
  tenantId: string;
  to: string;
  text: string;
  correlationId?: string;
}>;

export interface SmsProviderPort {
  send(message: SmsMessage): Promise<void>;
}
```

이 포트는 SMS 벤더 구현을 교체하기 위한 핵심 확장 지점입니다.

---

## 4.3 NotificationService

application/services/notification.service.ts

```ts
import { Inject, Injectable } from '@nestjs/common';
import { NOTIFICATION_PORT, NotificationMessage } from '../ports/notification.port';
import { EmailSmtpChannel } from '@infrastructure/notification/channels/email-smtp.channel';
import { SmsChannel } from '@infrastructure/notification/channels/sms.channel';

@Injectable()
export class NotificationService implements NotificationPort {
  constructor(
    private readonly emailChannel: EmailSmtpChannel,
    private readonly smsChannel: SmsChannel,
  ) {}

  async notify(message: NotificationMessage): Promise<void> {
    for (const channel of message.channels) {
      if (channel === 'email') {
        await this.emailChannel.send(message);
      }

      if (channel === 'sms') {
        await this.smsChannel.send(message);
      }
    }
  }
}
```

---

# 5. Infrastructure Layer

## 5.1 Email SMTP Channel

infrastructure/notification/channels/email-smtp.channel.ts

```ts
@Injectable()
export class EmailSmtpChannel {
  async send(msg: NotificationMessage): Promise<void> {
    if (!msg.to.email) return;

    const rendered = `[${msg.template}] ${JSON.stringify(msg.data ?? {})}`;

    // TODO: nodemailer 또는 SES 연결
    console.log('EMAIL SENT:', {
      to: msg.to.email,
      text: rendered,
    });
  }
}
```

---

## 5.2 SMS Channel

infrastructure/notification/channels/sms.channel.ts

```ts
import { Inject, Injectable } from '@nestjs/common';
import { SMS_PROVIDER, SmsProviderPort } from '@application/ports/sms.port';
import { NotificationMessage } from '@application/ports/notification.port';

@Injectable()
export class SmsChannel {
  constructor(
    @Inject(SMS_PROVIDER)
    private readonly provider: SmsProviderPort,
  ) {}

  async send(msg: NotificationMessage): Promise<void> {
    if (!msg.to.phone) return;

    const rendered = `[${msg.template}] ${JSON.stringify(msg.data ?? {})}`;

    await this.provider.send({
      tenantId: msg.tenantId,
      to: msg.to.phone,
      text: rendered,
      correlationId: msg.correlationId,
    });
  }
}
```

---

## 5.3 기본 SMS Provider (Console)

infrastructure/sms/console-sms.provider.ts

```ts
import { Injectable } from '@nestjs/common';
import { SmsProviderPort, SmsMessage } from '@application/ports/sms.port';

@Injectable()
export class ConsoleSmsProvider implements SmsProviderPort {
  async send(message: SmsMessage): Promise<void> {
    console.log('SMS SENT:', {
      to: message.to,
      text: message.text,
    });
  }
}
```

---

## 5.4 NotificationModule

infrastructure/notification/notification.module.ts

```ts
import { Module } from '@nestjs/common';
import { NotificationService } from '@application/services/notification.service';
import { EmailSmtpChannel } from './channels/email-smtp.channel';
import { SmsChannel } from './channels/sms.channel';
import { SMS_PROVIDER } from '@application/ports/sms.port';
import { ConsoleSmsProvider } from '../sms/console-sms.provider';
import { NOTIFICATION_PORT } from '@application/ports/notification.port';

@Module({
  providers: [
    NotificationService,
    EmailSmtpChannel,
    SmsChannel,
    ConsoleSmsProvider,
    {
      provide: SMS_PROVIDER,
      useExisting: ConsoleSmsProvider,
    },
    {
      provide: NOTIFICATION_PORT,
      useExisting: NotificationService,
    },
  ],
  exports: [NOTIFICATION_PORT],
})
export class NotificationModule {}
```

---

# 6. SMS Provider 교체 방법 (패턴 A)

사용자는 자신의 프로젝트에서 SMS_PROVIDER를 재정의하면 됩니다.

```ts
class MySmsProvider {
  async send({ to, text }: any) {
    // Twilio / NCP SENS / 내부 게이트웨이
  }
}

@Module({
  imports: [NotificationModule],
  providers: [
    { provide: SMS_PROVIDER, useClass: MySmsProvider },
  ],
})
export class AppModule {}
```

---

# 7. 보안 가이드

절대 금지:
- AccessToken, RefreshToken, ClientSecret 전송
- Authorization Code 전송
- 민감 정보 로그 출력

권장:
- OTP/링크는 짧은 TTL
- E.164 전화번호 사용
- SMS/메일 API에 rate limit 적용

---

# 8. 체크리스트

[ ] domain 레이어에 알림 로직 없음  
[ ] application은 Port에만 의존  
[ ] SMS_PROVIDER 교체 가능  
[ ] 토큰/시크릿 로그 금지  
[ ] rate limit 적용 고려  

---

Production 환경에서는 반드시
- 실제 SMTP
- 실제 SMS Provider
- TLS 연결
- 인증 구성

을 적용하십시오.