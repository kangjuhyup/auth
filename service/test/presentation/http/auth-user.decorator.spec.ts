import 'reflect-metadata';
import type { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { AuthUser } from '@presentation/http/auth-user.decorator';

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

describe('AuthUser decorator', () => {
  class TestController {
    handler(@AuthUser() _authUser: unknown) {}
  }

  it('request.authUser를 그대로 반환한다', () => {
    const authUser = { userId: 'user-1', clientId: 'client-1' };
    const factory = getDecoratorFactory(TestController, 'handler');

    const result = factory(undefined, makeExecutionContext({ authUser }));

    expect(result).toBe(authUser);
  });
});
