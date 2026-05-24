import { CorrelationIdMiddleware } from '@presentation/http/correlation-id.middleware';

describe('CorrelationIdMiddleware', () => {
  it('안전한 x-correlation-id를 request와 response에 전파한다', () => {
    const middleware = new CorrelationIdMiddleware();
    const req = {
      headers: { 'x-correlation-id': 'req-123' },
    } as any;
    const res = {
      setHeader: jest.fn(),
    } as any;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(req.correlationId).toBe('req-123');
    expect(res.setHeader).toHaveBeenCalledWith('x-correlation-id', 'req-123');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('헤더가 없거나 안전하지 않으면 새 correlationId를 발급한다', () => {
    const middleware = new CorrelationIdMiddleware();
    const req = {
      headers: { 'x-correlation-id': 'bad\nheader' },
    } as any;
    const res = {
      setHeader: jest.fn(),
    } as any;

    middleware.use(req, res, jest.fn());

    expect(req.correlationId).toMatch(/^[A-Z0-9]{26}$/);
    expect(res.setHeader).toHaveBeenCalledWith(
      'x-correlation-id',
      req.correlationId,
    );
  });
});
