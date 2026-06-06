import 'reflect-metadata';
import type { AuditContext } from '@application/dto';
import type { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { AdminAuditContext } from '@presentation/http/admin-audit-context.decorator';

function makeExecutionContext(
  request: Record<string, unknown>,
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as any;
}

type ParamDecoratorFactory = (data: unknown, ctx: ExecutionContext) => unknown;

function getDecoratorFactory(
  target: object,
  methodName: string,
): ParamDecoratorFactory {
  const metadata =
    Reflect.getMetadata(ROUTE_ARGS_METADATA, target, methodName) ?? {};
  const paramMetadata = Object.values(metadata)[0] as
    | { factory: ParamDecoratorFactory }
    | undefined;

  if (!paramMetadata) {
    throw new Error('Decorator metadata not found');
  }

  return paramMetadata.factory;
}

describe('AdminAuditContext decorator', () => {
  class TestController {
    handler(@AdminAuditContext() auditContext: unknown) {
      void auditContext;
    }
  }

  it('admin session과 request metadata를 audit context로 변환한다', () => {
    const factory = getDecoratorFactory(TestController, 'handler');

    const result = factory(
      undefined,
      makeExecutionContext({
        adminSession: { userId: 'user-1', username: 'admin' },
        ip: '203.0.113.10',
        correlationId: 'req-1',
        headers: {
          'user-agent': 'jest',
          'x-correlation-id': 'header-correlation',
        },
      }),
    );

    expect(result).toEqual({
      actorUserId: 'user-1',
      actorUsername: 'admin',
      ipAddress: '203.0.113.10',
      userAgent: 'jest',
      correlationId: 'req-1',
    });
  });

  it('correlationId가 없으면 correlation header와 request id header를 순서대로 사용한다', () => {
    const factory = getDecoratorFactory(TestController, 'handler');

    const withCorrelationHeader = factory(
      undefined,
      makeExecutionContext({
        headers: {
          'x-correlation-id': ['req-from-correlation-header'],
          'x-request-id': 'req-from-request-id',
        },
      }),
    ) as AuditContext;
    const withRequestIdHeader = factory(
      undefined,
      makeExecutionContext({
        headers: {
          'x-correlation-id': [123],
          'x-request-id': 'req-from-request-id',
        },
      }),
    ) as AuditContext;

    expect(withCorrelationHeader.correlationId).toBe(
      'req-from-correlation-header',
    );
    expect(withRequestIdHeader.correlationId).toBe('req-from-request-id');
  });

  it('값이 없거나 문자열이 아니면 null audit context를 반환한다', () => {
    const factory = getDecoratorFactory(TestController, 'handler');

    const result = factory(
      undefined,
      makeExecutionContext({
        adminSession: undefined,
        ip: undefined,
        headers: {
          'user-agent': [123],
          'x-correlation-id': 123,
          'x-request-id': [false],
        },
      }),
    );

    expect(result).toEqual({
      actorUserId: null,
      actorUsername: null,
      ipAddress: null,
      userAgent: null,
      correlationId: null,
    });
  });
});
