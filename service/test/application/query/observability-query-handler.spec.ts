import { ObservabilityQueryHandler } from '@application/queries/handlers/observability-query.handler';
import { ReadinessComponentDto } from '@application/dto/observability.dto';

describe('ObservabilityQueryHandler', () => {
  it('모든 readiness component가 ready면 ready 상태를 반환한다', async () => {
    const readinessCheck = {
      check: jest.fn().mockResolvedValue([
        ReadinessComponentDto.of({
          name: 'db',
          status: 'ready',
          latencyMs: 1,
        }),
      ]),
    };
    const metrics = {
      incrementCounter: jest.fn(),
      observeLatency: jest.fn(),
      snapshot: jest.fn().mockReturnValue({ counters: [], latencies: [] }),
    };
    const handler = new ObservabilityQueryHandler(
      readinessCheck as any,
      metrics as any,
    );

    await expect(handler.getReadiness()).resolves.toEqual({
      status: 'ready',
      components: [
        {
          name: 'db',
          status: 'ready',
          latencyMs: 1,
          reason: null,
        },
      ],
    });
  });

  it('하나라도 not_ready면 전체 readiness를 not_ready로 반환한다', async () => {
    const readinessCheck = {
      check: jest.fn().mockResolvedValue([
        ReadinessComponentDto.of({
          name: 'redis',
          status: 'not_ready',
          latencyMs: 3,
          reason: 'Redis ping failed',
        }),
      ]),
    };
    const metrics = {
      incrementCounter: jest.fn(),
      observeLatency: jest.fn(),
      snapshot: jest.fn().mockReturnValue({ counters: [], latencies: [] }),
    };
    const handler = new ObservabilityQueryHandler(
      readinessCheck as any,
      metrics as any,
    );

    await expect(handler.getReadiness()).resolves.toMatchObject({
      status: 'not_ready',
      components: [{ name: 'redis', status: 'not_ready' }],
    });
  });

  it('metrics snapshot을 그대로 반환한다', () => {
    const snapshot = { counters: [{ name: 'login_success_total', value: 1 }] };
    const handler = new ObservabilityQueryHandler(
      { check: jest.fn() } as any,
      {
        incrementCounter: jest.fn(),
        observeLatency: jest.fn(),
        snapshot: jest.fn().mockReturnValue(snapshot),
      } as any,
    );

    expect(handler.getMetrics()).toBe(snapshot);
  });
});
