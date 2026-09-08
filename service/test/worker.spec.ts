import { ConsoleLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { bootstrapWorker } from '../src/worker';
import { WorkerModule } from '../src/worker.module';

jest.mock('../src/worker.module', () => ({
  WorkerModule: class WorkerModule {},
}));
jest.mock('@nestjs/core', () => ({
  NestFactory: { createApplicationContext: jest.fn() },
}));

describe('standalone cleanup process bootstrap', () => {
  it('starts only an application context with graceful shutdown hooks', async () => {
    const app = { useLogger: jest.fn(), enableShutdownHooks: jest.fn() };
    jest
      .mocked(NestFactory.createApplicationContext)
      .mockResolvedValue(app as never);
    await bootstrapWorker();
    expect(NestFactory.createApplicationContext).toHaveBeenCalledWith(
      WorkerModule,
      { abortOnError: false, logger: false },
    );
    expect(app.enableShutdownHooks).toHaveBeenCalledWith(['SIGTERM', 'SIGINT']);
    expect(app.useLogger).toHaveBeenCalledWith(expect.any(ConsoleLogger));
  });
  it('propagates startup failure to the process entrypoint', async () => {
    jest
      .mocked(NestFactory.createApplicationContext)
      .mockRejectedValue(new Error('db unavailable'));
    await expect(bootstrapWorker()).rejects.toThrow('db unavailable');
  });
});
