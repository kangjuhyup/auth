import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseDockerInspectIdentity,
  parseDockerStats,
  parsePostgresConnectionCount,
  parsePostgresStatus,
  parseRedisInfo,
  parseRedisStatus,
  startMonitor,
  summarizeMonitorSamples,
} from '../lib/monitor.mjs';

const IDS = Object.freeze({
  'auth-service': 'a'.repeat(64),
  'postgres-load': 'b'.repeat(64),
  'redis-load': 'c'.repeat(64),
});

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test('parseDockerStats converts bounded Docker units to numeric fields', () => {
  assert.deepEqual(
    parseDockerStats(
      JSON.stringify({
        ID: IDS['auth-service'].slice(0, 12),
        Name: 'auth-load-auth-service-1',
        CPUPerc: '12.50%',
        MemUsage: '64MiB / 2GiB',
        NetIO: '1.5kB / 2MB',
      }),
    ),
    {
      containerId: IDS['auth-service'].slice(0, 12),
      name: 'auth-load-auth-service-1',
      cpuPercent: 12.5,
      memoryUsageBytes: 67_108_864,
      memoryLimitBytes: 2_147_483_648,
      networkInputBytes: 1_500,
      networkOutputBytes: 2_000_000,
    },
  );
});

test('operational parsers reject malformed input without echoing it', () => {
  const secret = 'secret-value-that-must-not-be-echoed';
  for (const parse of [
    () => parseDockerStats(secret),
    () => parsePostgresConnectionCount(`12\n${secret}`),
    () => parseRedisInfo(`connected_clients:12\nused_memory:${secret}`),
  ]) {
    assert.throws(parse, (error) => {
      assert.doesNotMatch(error.message, new RegExp(secret));
      return true;
    });
  }
});

test('parsePostgresConnectionCount accepts one non-negative integer', () => {
  assert.equal(parsePostgresConnectionCount('17\n'), 17);
  assert.throws(
    () => parsePostgresConnectionCount('-1\n'),
    /PostgreSQL connection count/,
  );
});

test('dependency status parsers retain bounded persistent error counters', () => {
  assert.deepEqual(parsePostgresStatus('17|2\n'), {
    connectionCount: 17,
    persistentErrors: 2,
  });
  assert.deepEqual(
    parseRedisStatus(
      'connected_clients:12\r\nused_memory:4096\r\nrejected_connections:3\r\n',
    ),
    {
      connectedClients: 12,
      usedMemoryBytes: 4096,
      rejectedConnections: 3,
    },
  );
});

test('Docker inspect identity parser accepts only bounded safe lifecycle fields', () => {
  const line = `${JSON.stringify(IDS['auth-service'])}\t1\t137\ttrue\t"auth-load"\t"auth-service"`;
  assert.deepEqual(parseDockerInspectIdentity(line), {
    containerId: IDS['auth-service'],
    restartCount: 1,
    exitCode: 137,
    oomKilled: true,
    project: 'auth-load',
    service: 'auth-service',
  });
  assert.throws(
    () => parseDockerInspectIdentity(`${line}\t"unexpected"`),
    /Docker inspect identity/,
  );
  assert.throws(
    () => parseDockerInspectIdentity('"missing"\t0\t0\tfalse\t"auth-load"'),
    /Docker inspect identity/,
  );
  assert.throws(
    () =>
      parseDockerInspectIdentity(
        `${JSON.stringify(IDS['auth-service'])}\t0\t0\tfalse\t"wrong-project"\t"auth-service"`,
      ),
    /Docker inspect identity/,
  );
  for (const [exitCode, oomKilled] of [
    [-1, false],
    [256, false],
    [1.5, false],
    [0, 'false'],
  ]) {
    assert.throws(
      () =>
        parseDockerInspectIdentity(
          `${JSON.stringify(IDS['auth-service'])}\t0\t${JSON.stringify(exitCode)}\t${JSON.stringify(oomKilled)}\t"auth-load"\t"auth-service"`,
        ),
      /Docker inspect identity/,
    );
  }
});

test('parseRedisInfo returns only bounded operational fields', () => {
  assert.deepEqual(
    parseRedisInfo(
      '# Clients\r\nconnected_clients:12\r\n# Memory\r\nused_memory:4096\r\n',
    ),
    { connectedClients: 12, usedMemoryBytes: 4096 },
  );
});

function monitorDependencies({
  duplicateAuth = false,
  extraK6 = false,
  missingService,
  wrongProjectService,
  swappedInspectIdentity = false,
  deferStatsCall,
  postgresFailures = 0,
  redisFailures = 0,
  postgresFailureCalls = [],
  redisFailureCalls = [],
  postgresStatuses = ['7|2\n'],
  redisStatuses = [
    'connected_clients:4\r\nused_memory:8192\r\nrejected_connections:3\r\n',
  ],
  exitCodes = {},
  oomKilled = {},
} = {}) {
  const commands = [];
  const writes = [];
  let intervalCallback;
  let intervalMilliseconds;
  let postgresCalls = 0;
  let redisCalls = 0;
  let statsCalls = 0;
  let currentMissingService = missingService;
  const serviceStates = Object.fromEntries(
    Object.keys(IDS).map((service) => [service, 'running']),
  );
  const delayedStats = deferred();

  function composeRows() {
    const rows = Object.entries(IDS)
      .filter(([service]) => service !== currentMissingService)
      .map(([service, id]) => ({
        ID: id,
        Name: `auth-load-${service}-1`,
        Project:
          service === wrongProjectService ? 'wrong-project' : 'auth-load',
        Service: service,
        State: serviceStates[service],
      }));
    if (duplicateAuth) {
      rows.push({
        ...rows.find(({ Service }) => Service === 'auth-service'),
        ID: 'd'.repeat(64),
        Name: 'auth-load-auth-service-2',
      });
    }
    if (extraK6) {
      rows.push({
        ID: 'e'.repeat(64),
        Name: 'auth-load-k6-run-123',
        Project: 'auth-load',
        Service: 'k6',
        State: 'running',
      });
    }
    return rows;
  }

  function statsResult(rows) {
    return {
      exitCode: 0,
      stdout: rows
        .filter(
          ({ Service, State }) =>
            Object.hasOwn(IDS, Service) && State === 'running',
        )
        .map(({ Service: service, ID: id }, index) =>
          JSON.stringify({
            ID: id.slice(0, 12),
            Name: `auth-load-${service}-1`,
            CPUPerc: `${index + 1}%`,
            MemUsage: `${index + 1}MiB / 2GiB`,
            NetIO: `${index + 1}kB / ${index + 2}kB`,
          }),
        )
        .join('\n'),
      stderr: '',
    };
  }

  return {
    commands,
    writes,
    deps: {
      async runCommand(file, args) {
        commands.push([file, args]);
        if (file === 'docker' && args[0] === 'stats') {
          statsCalls += 1;
          const result = statsResult(composeRows());
          if (statsCalls === deferStatsCall) {
            await delayedStats.promise;
          }
          return result;
        }
        if (file === 'docker' && args[0] === 'inspect') {
          return {
            exitCode: 0,
            stdout: composeRows()
              .filter(({ Service }) => Object.hasOwn(IDS, Service))
              .map(({ Service: service, ID: id }) =>
                [
                  JSON.stringify(id),
                  service === 'auth-service' ? '1' : '0',
                  JSON.stringify(exitCodes[service] ?? 0),
                  JSON.stringify(oomKilled[service] ?? false),
                  '"auth-load"',
                  JSON.stringify(
                    swappedInspectIdentity && service === 'auth-service'
                      ? 'postgres-load'
                      : swappedInspectIdentity && service === 'postgres-load'
                        ? 'auth-service'
                        : service,
                  ),
                ].join('\t'),
              )
              .join('\n'),
            stderr: '',
          };
        }
        if (args.includes('--format') && args.includes('json')) {
          return {
            exitCode: 0,
            stdout: JSON.stringify(composeRows()),
            stderr: '',
          };
        }
        if (args.includes('ps') && args.includes('-q')) {
          const ids = composeRows()
            .filter(
              ({ Service, State }) =>
                Object.hasOwn(IDS, Service) &&
                (args.includes('--all') || State === 'running'),
            )
            .map(({ ID }) => ID);
          return { exitCode: 0, stdout: `${ids.join('\n')}\n`, stderr: '' };
        }
        if (args.includes('psql')) {
          postgresCalls += 1;
          if (
            postgresCalls <= postgresFailures ||
            postgresFailureCalls.includes(postgresCalls)
          )
            return { exitCode: 1, stdout: '', stderr: 'not retained' };
          const successIndex = postgresCalls - postgresFailures - 1;
          return {
            exitCode: 0,
            stdout:
              postgresStatuses[
                Math.min(successIndex, postgresStatuses.length - 1)
              ],
            stderr: '',
          };
        }
        if (args.includes('redis-cli')) {
          redisCalls += 1;
          if (
            redisCalls <= redisFailures ||
            redisFailureCalls.includes(redisCalls)
          )
            return { exitCode: 1, stdout: '', stderr: 'not retained' };
          const successIndex = redisCalls - redisFailures - 1;
          return {
            exitCode: 0,
            stdout:
              redisStatuses[Math.min(successIndex, redisStatuses.length - 1)],
            stderr: '',
          };
        }
        throw new Error('unexpected test command');
      },
      async writeFile(path, value, options) {
        writes.push({ kind: 'write', path, value, options });
      },
      async appendFile(path, value) {
        writes.push({ kind: 'append', path, value });
      },
      now: () => new Date('2026-09-02T01:02:03.000Z'),
      setInterval(callback, milliseconds) {
        intervalCallback = callback;
        intervalMilliseconds = milliseconds;
        return 123;
      },
      clearInterval() {},
    },
    tick() {
      intervalCallback();
    },
    setServiceState(service, state) {
      serviceStates[service] = state;
    },
    setMissingService(service) {
      currentMissingService = service;
    },
    releaseStats() {
      delayedStats.resolve();
    },
    intervalMilliseconds: () => intervalMilliseconds,
  };
}

test('startMonitor resolves exact dedicated containers before sampling only their IDs', async () => {
  const { deps, commands, writes, intervalMilliseconds } =
    monitorDependencies();
  const monitor = startMonitor(deps, 'load-tests/results/run/docker-stats.csv');
  await monitor.ready();
  await monitor.stop();

  const quietPsIndex = commands.findIndex(
    ([, args]) => args.includes('ps') && args.includes('-q'),
  );
  const statsIndex = commands.findIndex(([, args]) => args[0] === 'stats');
  const inspect = commands.find(([, args]) => args[0] === 'inspect');
  assert.ok(quietPsIndex >= 0 && quietPsIndex < statsIndex);
  assert.deepEqual(commands[statsIndex], [
    'docker',
    [
      'stats',
      '--no-stream',
      '--format',
      '{{json .}}',
      IDS['auth-service'],
      IDS['postgres-load'],
      IDS['redis-load'],
    ],
  ]);
  assert.match(inspect[1][2], /RestartCount/);
  assert.match(inspect[1][2], /State\.ExitCode/);
  assert.match(inspect[1][2], /State\.OOMKilled/);
  assert.doesNotMatch(inspect[1][2], /Config\.Env|json \.\}\}/);
  assert.equal(writes[0].options.mode, 0o600);
  assert.match(
    writes.map(({ value }) => value).join(''),
    /auth-service,running,1,1048576,2147483648/,
  );
  assert.match(writes[0].value, /exit_code,oom_killed/);
  assert.match(writes.map(({ value }) => value).join(''), /,1,0,false,7,4,/);
  assert.equal(intervalMilliseconds(), 5_000);
  const composePs = commands.find(
    ([, args]) => args.includes('ps') && args.includes('--format'),
  );
  assert.equal(composePs[1].includes('--all'), true);
  assert.equal(
    composePs[1].includes('--no-trunc'),
    true,
    'Compose JSON IDs must be full-length before exact identity comparison',
  );
});

test('terminal samples retain exact stopped exit metadata and missing sentinels', async () => {
  const stopped = monitorDependencies({
    exitCodes: { 'auth-service': 137 },
    oomKilled: { 'auth-service': true },
  });
  stopped.setServiceState('auth-service', 'exited');
  const stoppedMonitor = startMonitor(
    stopped.deps,
    'load-tests/results/run/docker-stats.csv',
  );
  await stoppedMonitor.ready();
  const stoppedService = stoppedMonitor.snapshot()[0].services['auth-service'];
  assert.equal(stoppedService.status, 'stopped');
  assert.equal(stoppedService.exitCode, 137);
  assert.equal(stoppedService.oomKilled, true);
  assert.match(
    stopped.writes.map(({ value }) => value).join(''),
    /auth-service,stopped,0,0,0,0,0,1,137,true/,
  );
  await stoppedMonitor.stop();

  const missing = monitorDependencies({ missingService: 'auth-service' });
  const missingMonitor = startMonitor(
    missing.deps,
    'load-tests/results/run/docker-stats.csv',
  );
  await missingMonitor.ready();
  const missingService = missingMonitor.snapshot()[0].services['auth-service'];
  assert.equal(missingService.status, 'missing');
  assert.equal(missingService.exitCode, null);
  assert.equal(missingService.oomKilled, null);
  assert.match(
    missing.writes.map(({ value }) => value).join(''),
    /auth-service,missing,0,0,0,0,0,0,unknown,unknown/,
  );
  await missingMonitor.stop();
});

test('running targets reject stopped-only exit metadata', async () => {
  for (const invalid of [
    { exitCodes: { 'auth-service': 137 } },
    { oomKilled: { 'auth-service': true } },
  ]) {
    const harness = monitorDependencies(invalid);
    const monitor = startMonitor(
      harness.deps,
      'load-tests/results/run/docker-stats.csv',
    );
    await assert.rejects(monitor.ready(), /Docker inspect response/);
    await assert.rejects(monitor.stop(), /Docker inspect response/);
  }
});

test('checkpoint awaits an in-flight interval sample and forces a terminal sample', async () => {
  const harness = monitorDependencies({ deferStatsCall: 2 });
  const monitor = startMonitor(
    harness.deps,
    'load-tests/results/run/docker-stats.csv',
  );
  await monitor.ready();
  harness.tick();
  await new Promise((resolve) => globalThis.setImmediate(resolve));

  let settled = false;
  const checkpoint = monitor.checkpoint().then(() => {
    settled = true;
  });
  harness.setServiceState('auth-service', 'exited');
  await new Promise((resolve) => globalThis.setImmediate(resolve));
  assert.equal(settled, false);

  harness.releaseStats();
  await checkpoint;
  assert.equal(monitor.snapshot().length, 3);
  assert.equal(
    monitor.snapshot().at(-1).services['auth-service'].status,
    'stopped',
  );
  await monitor.stop();
});

test('startMonitor fails closed when a dedicated service container is duplicated', async () => {
  const { deps } = monitorDependencies({ duplicateAuth: true });
  const monitor = startMonitor(deps, 'load-tests/results/run/docker-stats.csv');
  await assert.rejects(monitor.ready(), /dedicated service containers/);
  await assert.rejects(monitor.stop(), /dedicated service containers/);
});

test('startMonitor ignores an active scoped k6 one-off and preserves a missing target service', async () => {
  const withK6 = monitorDependencies({ extraK6: true });
  await startMonitor(
    withK6.deps,
    'load-tests/results/run/docker-stats.csv',
  ).stop();
  const stats = withK6.commands.find(([, args]) => args[0] === 'stats');
  assert.equal(stats[1].includes('e'.repeat(64)), false);

  const missing = monitorDependencies({ missingService: 'redis-load' });
  const missingMonitor = startMonitor(
    missing.deps,
    'load-tests/results/run/docker-stats.csv',
  );
  await missingMonitor.ready();
  assert.equal(
    missingMonitor.snapshot()[0].services['redis-load'].status,
    'missing',
  );
  await missingMonitor.stop();
});

test('startMonitor preserves stopped state for every expected load target', async () => {
  for (const service of Object.keys(IDS)) {
    const harness = monitorDependencies();
    const monitor = startMonitor(
      harness.deps,
      'load-tests/results/run/docker-stats.csv',
    );
    await monitor.ready();
    harness.setServiceState(service, 'exited');
    await monitor.checkpoint();
    const finalSample = monitor.snapshot().at(-1);
    assert.equal(finalSample.services[service].status, 'stopped');
    if (service !== 'auth-service') {
      assert.ok(finalSample.dependencyErrors > 0);
    }
    await monitor.stop();
  }
});

test('startMonitor still aborts on wrong-project target identity', async () => {
  const harness = monitorDependencies({ wrongProjectService: 'auth-service' });
  const monitor = startMonitor(
    harness.deps,
    'load-tests/results/run/docker-stats.csv',
  );
  await assert.rejects(monitor.ready(), /dedicated service containers/);
  await assert.rejects(monitor.stop(), /dedicated service containers/);
});

test('startMonitor aborts when inspect labels do not match discovered container IDs', async () => {
  const harness = monitorDependencies({ swappedInspectIdentity: true });
  const monitor = startMonitor(
    harness.deps,
    'load-tests/results/run/docker-stats.csv',
  );
  await assert.rejects(monitor.ready(), /Docker inspect response/);
  await assert.rejects(monitor.stop(), /Docker inspect response/);
});

test('startMonitor treats nonzero lifetime counters on its first sample as the baseline', async () => {
  const harness = monitorDependencies();
  const monitor = startMonitor(
    harness.deps,
    'load-tests/results/run/docker-stats.csv',
  );
  await monitor.ready();
  assert.equal(monitor.snapshot().length, 1);
  await monitor.stop();
  assert.equal(monitor.snapshot()[0].dependencyErrors, 0);
});

test('startMonitor readiness rejects an invalid initial dependency sample', async () => {
  const harness = monitorDependencies({
    postgresStatuses: ['malformed-postgres-status'],
  });
  const monitor = startMonitor(
    harness.deps,
    'load-tests/results/run/docker-stats.csv',
  );
  await assert.rejects(monitor.ready(), /Invalid PostgreSQL status/);
  await assert.rejects(monitor.stop(), /Invalid PostgreSQL status/);
});

test('startMonitor readiness rejects failed initial PostgreSQL or Redis probes', async () => {
  for (const failures of [{ postgresFailures: 1 }, { redisFailures: 1 }]) {
    const harness = monitorDependencies(failures);
    const monitor = startMonitor(
      harness.deps,
      'load-tests/results/run/docker-stats.csv',
    );
    await assert.rejects(monitor.ready(), /Initial dependency probe failed/);
    await assert.rejects(monitor.stop(), /Initial dependency probe failed/);
  }
});

test('startMonitor reports later counter growth as a persistent baseline delta', async () => {
  const harness = monitorDependencies({
    postgresStatuses: ['7|2\n', '7|4\n', '7|4\n'],
    redisStatuses: [
      'connected_clients:4\r\nused_memory:8192\r\nrejected_connections:3\r\n',
      'connected_clients:4\r\nused_memory:8192\r\nrejected_connections:6\r\n',
      'connected_clients:4\r\nused_memory:8192\r\nrejected_connections:6\r\n',
    ],
  });
  const monitor = startMonitor(
    harness.deps,
    'load-tests/results/run/docker-stats.csv',
  );
  await new Promise((resolve) => globalThis.setImmediate(resolve));
  harness.tick();
  harness.tick();
  await monitor.stop();
  assert.deepEqual(
    monitor.snapshot().map(({ dependencyErrors }) => dependencyErrors),
    [0, 5, 5],
  );
});

test('startMonitor retains recovered scheduled probe failures after baselines succeed', async () => {
  const harness = monitorDependencies({
    postgresFailureCalls: [2],
    redisFailureCalls: [2],
  });
  const monitor = startMonitor(
    harness.deps,
    'load-tests/results/run/docker-stats.csv',
  );
  await new Promise((resolve) => globalThis.setImmediate(resolve));
  harness.tick();
  harness.tick();
  await monitor.stop();
  const samples = monitor.snapshot();
  assert.deepEqual(
    samples.map(({ dependencyErrors }) => dependencyErrors),
    [0, 2, 2],
  );
  assert.equal(samples[2].postgresConnections, 7);
  assert.equal(samples[2].redis.connectedClients, 4);
});

test('startMonitor fails closed when a persistent dependency counter resets', async () => {
  const harness = monitorDependencies({
    postgresStatuses: ['7|2\n', '7|1\n'],
  });
  const monitor = startMonitor(
    harness.deps,
    'load-tests/results/run/docker-stats.csv',
  );
  await new Promise((resolve) => globalThis.setImmediate(resolve));
  harness.tick();
  await assert.rejects(monitor.stop(), /dependency counter reset/);
});

test('summarizeMonitorSamples returns strict aggregate bottleneck peaks', () => {
  const service = (
    status,
    cpu,
    memory,
    networkIn,
    networkOut,
    restartCount,
  ) => ({
    status,
    cpuPercent: cpu,
    memoryUsageBytes: memory,
    memoryLimitBytes: 10_000,
    networkInputBytes: networkIn,
    networkOutputBytes: networkOut,
    restartCount,
    exitCode: status === 'missing' ? null : status === 'stopped' ? 137 : 0,
    oomKilled: status === 'missing' ? null : status === 'stopped',
  });
  const summary = summarizeMonitorSamples([
    {
      timestamp: '2026-09-02T01:02:03.000Z',
      services: {
        'auth-service': service('running', 10, 100, 1_000, 2_000, 0),
        'postgres-load': service('running', 20, 200, 2_000, 3_000, 0),
        'redis-load': service('running', 30, 300, 3_000, 4_000, 0),
      },
      postgresConnections: 8,
      redis: { connectedClients: 9, usedMemoryBytes: 900 },
      dependencyErrors: 0,
    },
    {
      timestamp: '2026-09-02T01:02:08.000Z',
      services: {
        'auth-service': service('stopped', 0, 0, 0, 0, 1),
        'postgres-load': service('missing', 0, 0, 0, 0, 0),
        'redis-load': service('running', 35, 350, 3_500, 4_500, 0),
      },
      postgresConnections: 8,
      redis: { connectedClients: 10, usedMemoryBytes: 1_000 },
      dependencyErrors: 2,
    },
  ]);

  assert.deepEqual(summary, {
    sampleCount: 2,
    services: {
      'auth-service': {
        peakCpuPercent: 10,
        peakMemoryUsageBytes: 100,
        peakNetworkInputBytes: 1_000,
        peakNetworkOutputBytes: 2_000,
        maxRestartCount: 1,
        stoppedSamples: 1,
        missingSamples: 0,
        lastExitCode: 137,
        oomKilled: true,
      },
      'postgres-load': {
        peakCpuPercent: 20,
        peakMemoryUsageBytes: 200,
        peakNetworkInputBytes: 2_000,
        peakNetworkOutputBytes: 3_000,
        maxRestartCount: 0,
        stoppedSamples: 0,
        missingSamples: 1,
        lastExitCode: null,
        oomKilled: null,
      },
      'redis-load': {
        peakCpuPercent: 35,
        peakMemoryUsageBytes: 350,
        peakNetworkInputBytes: 3_500,
        peakNetworkOutputBytes: 4_500,
        maxRestartCount: 0,
        stoppedSamples: 0,
        missingSamples: 0,
        lastExitCode: 0,
        oomKilled: false,
      },
    },
    peakPostgresConnections: 8,
    peakRedisConnectedClients: 10,
    peakRedisUsedMemoryBytes: 1_000,
    dependencyErrors: 2,
  });
});
