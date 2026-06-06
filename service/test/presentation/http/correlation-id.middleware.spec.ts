import { CorrelationIdMiddleware } from '@presentation/http/correlation-id.middleware';

describe('CorrelationIdMiddleware', () => {
  let debugSpy: jest.SpyInstance;

  beforeEach(() => {
    debugSpy = jest.spyOn(console, 'debug').mockImplementation();
  });

  afterEach(() => {
    debugSpy.mockRestore();
  });

  it('안전한 x-correlation-id를 request와 response에 전파한다', () => {
    const middleware = new CorrelationIdMiddleware();
    const req = {
      headers: { 'x-correlation-id': 'req-123' },
    } as any;
    const res = {
      getHeader: jest.fn(),
      setHeader: jest.fn(),
    } as any;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(req.correlationId).toBe('req-123');
    expect(req.headers['x-correlation-id']).toBe('req-123');
    expect(res.setHeader).toHaveBeenCalledWith('x-correlation-id', 'req-123');
    expect(JSON.stringify(debugSpy.mock.calls)).toContain(
      'selected source=request_correlation_header',
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('헤더가 없거나 안전하지 않으면 새 correlationId를 발급한다', () => {
    const middleware = new CorrelationIdMiddleware();
    const req = {
      headers: { 'x-correlation-id': 'bad\nheader' },
    } as any;
    const res = {
      getHeader: jest.fn(),
      setHeader: jest.fn(),
    } as any;

    middleware.use(req, res, jest.fn());

    expect(req.correlationId).toMatch(/^[A-Z0-9]{26}$/);
    expect(req.headers['x-correlation-id']).toBe(req.correlationId);
    expect(res.setHeader).toHaveBeenCalledWith(
      'x-correlation-id',
      req.correlationId,
    );
  });

  it('rvlog가 먼저 설정한 response correlationId를 재사용한다', () => {
    const middleware = new CorrelationIdMiddleware();
    const req = {
      headers: { 'x-request-id': 'client-request-1' },
    } as any;
    const res = {
      getHeader: jest.fn().mockReturnValue('rvlog-req-1'),
      setHeader: jest.fn(),
    } as any;

    middleware.use(req, res, jest.fn());

    expect(req.correlationId).toBe('rvlog-req-1');
    expect(req.headers['x-correlation-id']).toBe('rvlog-req-1');
    expect(res.setHeader).toHaveBeenCalledWith(
      'x-correlation-id',
      'rvlog-req-1',
    );
  });
});
