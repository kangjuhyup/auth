import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseDockerStats,
  parsePostgresConnectionCount,
  parseRedisInfo,
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

test('parseRedisInfo returns only bounded operational fields', () => {
  assert.deepEqual(
    parseRedisInfo(
      '# Clients\r\nconnected_clients:12\r\n# Memory\r\nused_memory:4096\r\n',
    ),
    { connectedClients: 12, usedMemoryBytes: 4096 },
  );
});

function monitorDependencies({ duplicateAuth = false } = {}) {
  const commands = [];
  const writes = [];
  const composeRows = Object.entries(IDS).map(([service, id]) => ({
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

  return {
    commands,
    writes,
    deps: {
      async runCommand(file, args) {
        commands.push([file, args]);
        if (file === 'docker' && args.includes('stats')) {
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
                JSON.stringify({
                  Id: id,
                  RestartCount: service === 'auth-service' ? 1 : 0,
                  Config: {
                    Labels: {
                      'com.docker.compose.project': 'auth-load',
                      'com.docker.compose.service': service,
                    },
                  },
                }),
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
          const ids = composeRows.map(({ ID }) => ID);
          return { exitCode: 0, stdout: `${ids.join('\n')}\n`, stderr: '' };
        }
        if (args.includes('psql'))
          return { exitCode: 0, stdout: '7\n', stderr: '' };
        if (args.includes('redis-cli')) {
          return {
            exitCode: 0,
            stdout: 'connected_clients:4\r\nused_memory:8192\r\n',
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
      setInterval: () => 123,
      clearInterval() {},
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
  const statsIndex = commands.findIndex(([, args]) => args.includes('stats'));
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
