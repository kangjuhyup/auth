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
} from '../lib/monitor.mjs';

const IDS = Object.freeze({
  'auth-service': 'a'.repeat(64),
  'postgres-load': 'b'.repeat(64),
  'redis-load': 'c'.repeat(64),
});

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

test('Docker inspect identity parser accepts only the minimal four-field record', () => {
  const line = `${JSON.stringify(IDS['auth-service'])}\t1\t"auth-load"\t"auth-service"`;
  assert.deepEqual(parseDockerInspectIdentity(line), {
    containerId: IDS['auth-service'],
    restartCount: 1,
    project: 'auth-load',
    service: 'auth-service',
  });
  assert.throws(
    () => parseDockerInspectIdentity(`${line}\t"unexpected"`),
    /Docker inspect identity/,
  );
  assert.throws(
    () => parseDockerInspectIdentity('"missing"\t0\t"auth-load"'),
    /Docker inspect identity/,
  );
  assert.throws(
    () =>
      parseDockerInspectIdentity(
        `${JSON.stringify(IDS['auth-service'])}\t0\t"wrong-project"\t"auth-service"`,
      ),
    /Docker inspect identity/,
  );
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
  postgresFailures = 0,
  redisFailures = 0,
  postgresStatuses = ['7|2\n'],
  redisStatuses = [
    'connected_clients:4\r\nused_memory:8192\r\nrejected_connections:3\r\n',
  ],
} = {}) {
  const commands = [];
  const writes = [];
  let intervalCallback;
  let postgresCalls = 0;
  let redisCalls = 0;
  const composeRows = Object.entries(IDS)
    .filter(([service]) => service !== missingService)
    .map(([service, id]) => ({
      ID: id,
      Name: `auth-load-${service}-1`,
      Project: 'auth-load',
      Service: service,
      State: 'running',
    }));
  if (duplicateAuth) {
    composeRows.push({
      ...composeRows[0],
      ID: 'd'.repeat(64),
      Name: 'auth-load-auth-service-2',
    });
  }
  if (extraK6) {
    composeRows.push({
      ID: 'e'.repeat(64),
      Name: 'auth-load-k6-run-123',
      Project: 'untrusted-nontarget-project',
      Service: 'k6',
      State: 'running',
    });
  }

  return {
    commands,
    writes,
    deps: {
      async runCommand(file, args) {
        commands.push([file, args]);
        if (file === 'docker' && args[0] === 'stats') {
          return {
            exitCode: 0,
            stdout: Object.entries(IDS)
              .map(([service, id], index) =>
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
        if (file === 'docker' && args[0] === 'inspect') {
          return {
            exitCode: 0,
            stdout: Object.entries(IDS)
              .map(([service, id]) =>
                [
                  JSON.stringify(id),
                  service === 'auth-service' ? '1' : '0',
                  '"auth-load"',
                  JSON.stringify(service),
                ].join('\t'),
              )
              .join('\n'),
            stderr: '',
          };
        }
        if (args.includes('--format') && args.includes('json')) {
          return {
            exitCode: 0,
            stdout: JSON.stringify(composeRows),
            stderr: '',
          };
        }
        if (args.includes('ps') && args.includes('-q')) {
          const ids = composeRows
            .filter(({ Service }) => Object.hasOwn(IDS, Service))
            .map(({ ID }) => ID);
          return { exitCode: 0, stdout: `${ids.join('\n')}\n`, stderr: '' };
        }
        if (args.includes('psql')) {
          postgresCalls += 1;
          if (postgresCalls <= postgresFailures)
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
          if (redisCalls <= redisFailures)
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
      setInterval(callback) {
        intervalCallback = callback;
        return 123;
      },
      clearInterval() {},
    },
    tick() {
      intervalCallback();
    },
  };
}

test('startMonitor resolves exact dedicated containers before sampling only their IDs', async () => {
  const { deps, commands, writes } = monitorDependencies();
  const monitor = startMonitor(deps, 'load-tests/results/run/docker-stats.csv');
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
  assert.doesNotMatch(inspect[1][2], /Config\.Env|json \.\}\}/);
  assert.equal(writes[0].options.mode, 0o600);
  assert.match(
    writes.map(({ value }) => value).join(''),
    /auth-service,1,1048576,2147483648/,
  );
});

test('startMonitor fails closed when a dedicated service container is duplicated', async () => {
  const { deps } = monitorDependencies({ duplicateAuth: true });
  const monitor = startMonitor(deps, 'load-tests/results/run/docker-stats.csv');
  await assert.rejects(monitor.stop(), /dedicated service containers/);
});

test('startMonitor ignores an active k6 one-off but rejects a missing target service', async () => {
  const withK6 = monitorDependencies({ extraK6: true });
  await startMonitor(
    withK6.deps,
    'load-tests/results/run/docker-stats.csv',
  ).stop();
  const stats = withK6.commands.find(([, args]) => args[0] === 'stats');
  assert.equal(stats[1].includes('e'.repeat(64)), false);

  const missing = monitorDependencies({ missingService: 'redis-load' });
  await assert.rejects(
    startMonitor(
      missing.deps,
      'load-tests/results/run/docker-stats.csv',
    ).stop(),
    /dedicated service containers/,
  );
});

test('startMonitor treats nonzero lifetime counters on its first sample as the baseline', async () => {
  const harness = monitorDependencies();
  const monitor = startMonitor(
    harness.deps,
    'load-tests/results/run/docker-stats.csv',
  );
  await monitor.stop();
  assert.equal(monitor.snapshot()[0].dependencyErrors, 0);
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

test('startMonitor retains failed first probes after later baselines succeed', async () => {
  const harness = monitorDependencies({
    postgresFailures: 1,
    redisFailures: 1,
  });
  const monitor = startMonitor(
    harness.deps,
    'load-tests/results/run/docker-stats.csv',
  );
  await new Promise((resolve) => globalThis.setImmediate(resolve));
  harness.tick();
  await monitor.stop();
  const samples = monitor.snapshot();
  assert.equal(samples.length, 2);
  assert.equal(samples[0].dependencyErrors, 2);
  assert.equal(samples[1].dependencyErrors, 2);
  assert.equal(samples[1].postgresConnections, 7);
  assert.equal(samples[1].redis.connectedClients, 4);
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
