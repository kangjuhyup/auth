import 'reflect-metadata';
import type { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { Tenant } from '@presentation/http/tenant.decorator';

function makeExecutionContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as any;
}

function getDecoratorFactory(target: Function, methodName: string): Function {
  const metadata =
    Reflect.getMetadata(ROUTE_ARGS_METADATA, target, methodName) ?? {};
  const paramMetadata = Object.values(metadata)[0] as
    | { factory: Function }
    | undefined;

  if (!paramMetadata) {
    throw new Error('Decorator metadata not found');
  }

  return paramMetadata.factory;
}

describe('Tenant decorator', () => {
  class TestController {
    handler(@Tenant() _tenant: unknown) {}
  }

  it('request.tenant를 그대로 반환한다', () => {
    const tenant = { id: 'tenant-1', code: 'acme' };
    const factory = getDecoratorFactory(TestController, 'handler');

    const result = factory(undefined, makeExecutionContext({ tenant }));

    expect(result).toBe(tenant);
  });
});
