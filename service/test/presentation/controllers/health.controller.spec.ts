import { HealthController } from '@presentation/controllers/health.controller';

describe('HealthController', () => {
  it('헬스 체크 상태를 반환한다', () => {
    const observabilityQuery = {
      getHealth: jest.fn().mockReturnValue({ status: 'ok', uptimeSec: 12 }),
      getReadiness: jest.fn(),
      getMetrics: jest.fn(),
    };
    const controller = new HealthController(observabilityQuery as any);

    expect(controller.check()).toEqual({ status: 'ok', uptimeSec: 12 });
  });

  it('readiness와 metrics는 application query에 위임한다', async () => {
    const readiness = { status: 'ready', components: [] };
    const metrics = { counters: [], latencies: [] };
    const observabilityQuery = {
      getHealth: jest.fn(),
      getReadiness: jest.fn().mockResolvedValue(readiness),
      getMetrics: jest.fn().mockReturnValue(metrics),
    };
    const controller = new HealthController(observabilityQuery as any);

    await expect(controller.readiness()).resolves.toBe(readiness);
    expect(controller.metrics()).toBe(metrics);
  });
});
