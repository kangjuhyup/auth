import { cleanupE2eResources } from './e2e-cleanup';

describe('cleanupE2eResources', () => {
  it('리소스 종료가 실패해도 모든 전역 상태 복원기를 실행한다', async () => {
    const closeFailure = new Error('close failed');
    const restoreFetch = jest.fn();
    const restoreConsole = jest.fn();

    await expect(
      cleanupE2eResources({
        closeTasks: [
          async () => {
            throw closeFailure;
          },
        ],
        restorers: [restoreFetch, restoreConsole],
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        errors: [closeFailure],
        message: 'E2E cleanup failed',
      }),
    );

    expect(restoreFetch).toHaveBeenCalledTimes(1);
    expect(restoreConsole).toHaveBeenCalledTimes(1);
  });

  it('복원기 하나가 실패해도 나머지 복원기를 실행하고 오류를 모은다', async () => {
    const restoreFailure = new Error('restore failed');
    const restoreConsole = jest.fn();

    await expect(
      cleanupE2eResources({
        closeTasks: [],
        restorers: [
          () => {
            throw restoreFailure;
          },
          restoreConsole,
        ],
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        errors: [restoreFailure],
        message: 'E2E cleanup failed',
      }),
    );

    expect(restoreConsole).toHaveBeenCalledTimes(1);
  });
});
