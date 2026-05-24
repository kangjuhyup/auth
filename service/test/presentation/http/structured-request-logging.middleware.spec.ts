import { StructuredRequestLoggingMiddleware } from '@presentation/http/structured-request-logging.middleware';

describe('StructuredRequestLoggingMiddleware', () => {
  const originalLog = console.log;

  afterEach(() => {
    console.log = originalLog;
  });

  it('token이나 authorization header 없이 구조화된 HTTP 로그를 남긴다', () => {
    const log = jest.fn();
    console.log = log;
    const finishHandlers: Array<() => void> = [];
    const req = {
      method: 'POST',
      path: '/t/acme/oidc/token',
      headers: { authorization: 'Bearer secret-token' },
      tenant: { id: 'tenant-1' },
      correlationId: 'req-1',
    } as any;
    const res = {
      statusCode: 200,
      on: jest.fn((event: string, handler: () => void) => {
        if (event === 'finish') finishHandlers.push(handler);
      }),
    } as any;
    const next = jest.fn();

    new StructuredRequestLoggingMiddleware().use(req, res, next);
    finishHandlers[0]();

    const record = JSON.parse(log.mock.calls[0][0]);
    expect(record).toMatchObject({
      type: 'http_request',
      method: 'POST',
      path: '/t/acme/oidc/token',
      tenantId: 'tenant-1',
      correlationId: 'req-1',
    });
    expect(log.mock.calls[0][0]).not.toContain('secret-token');
    expect(next).toHaveBeenCalledTimes(1);
  });
});
