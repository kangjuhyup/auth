import { HealthController } from '@presentation/controllers/health.controller';

describe('HealthController', () => {
  it('헬스 체크 상태를 반환한다', () => {
    const controller = new HealthController();

    expect(controller.check()).toEqual({ status: 'ok' });
  });
});
