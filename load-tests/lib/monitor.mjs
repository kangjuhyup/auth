const COMPOSE_ARGS = Object.freeze([
  'compose',
  '--project-name',
  'auth-load',
  '-f',
  'docker-compose.load.yml',
]);
const SERVICES = Object.freeze(['auth-service', 'postgres-load', 'redis-load']);
const COMPOSE_SERVICES = new Set([...SERVICES, 'k6']);
const CONTAINER_STATES = new Set([
  'created',
  'dead',
  'exited',
  'paused',
  'removing',
  'restarting',
  'running',
]);
const INSPECT_IDENTITY_FORMAT = [
  '{{json .Id}}',
  '{{json .RestartCount}}',
  '{{json (index .Config.Labels "com.docker.compose.project")}}',
  '{{json (index .Config.Labels "com.docker.compose.service")}}',
].join('\t');
const CSV_HEADER = [
  'timestamp',
  'service',
  'status',
  'cpu_percent',
  'memory_usage_bytes',
  'memory_limit_bytes',
  'network_input_bytes',
  'network_output_bytes',
  'restart_count',
  'postgres_connections',
  'redis_connected_clients',
  'redis_used_memory_bytes',
  'postgres_persistent_errors',
  'redis_rejected_connections',
  'dependency_errors',
].join(',');

function boundedNumber(
  value,
  label,
  { integer = false, max = Number.MAX_SAFE_INTEGER } = {},
) {
  const valid = integer
    ? Number.isSafeInteger(value)
    : typeof value === 'number' && Number.isFinite(value);
  if (!valid || value < 0 || value > max)
    throw new TypeError(`Invalid ${label}`);
  return value;
}

function parseByteValue(raw, label) {
  if (typeof raw !== 'string') throw new TypeError(`Invalid ${label}`);
  const match = /^(\d+(?:\.\d+)?)\s*([kmgt]?i?b)$/i.exec(raw.trim());
  if (!match) throw new TypeError(`Invalid ${label}`);
  const units = {
    b: 1,
    kb: 1_000,
    mb: 1_000_000,
    gb: 1_000_000_000,
    tb: 1_000_000_000_000,
    kib: 1_024,
    mib: 1_048_576,
    gib: 1_073_741_824,
    tib: 1_099_511_627_776,
  };
  const value = Number(match[1]) * units[match[2].toLowerCase()];
  boundedNumber(value, label);
  return Math.round(value);
}

function parsePair(raw, label, parser) {
  if (typeof raw !== 'string') throw new TypeError(`Invalid ${label}`);
  const parts = raw.split('/').map((value) => value.trim());
  if (parts.length !== 2) throw new TypeError(`Invalid ${label}`);
  return parts.map((value) => parser(value, label));
}

function parseJson(raw, label) {
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error();
    return value;
  } catch {
    throw new TypeError(`Invalid ${label}`);
  }
}

function validContainerId(value) {
  return typeof value === 'string' && /^[a-f0-9]{12,64}$/i.test(value);
}

export function parseDockerStats(line) {
  const raw = parseJson(line, 'Docker stats record');
  if (!validContainerId(raw.ID))
    throw new TypeError('Invalid Docker stats container ID');
  if (
    typeof raw.Name !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(raw.Name)
  ) {
    throw new TypeError('Invalid Docker stats container name');
  }
  if (
    typeof raw.CPUPerc !== 'string' ||
    !/^\d+(?:\.\d+)?%$/.test(raw.CPUPerc.trim())
  ) {
    throw new TypeError('Invalid Docker CPU percentage');
  }
  const cpuPercent = Number(raw.CPUPerc.trim().slice(0, -1));
  boundedNumber(cpuPercent, 'Docker CPU percentage', { max: 1_000_000 });
  const [memoryUsageBytes, memoryLimitBytes] = parsePair(
    raw.MemUsage,
    'Docker memory usage',
    parseByteValue,
  );
  const [networkInputBytes, networkOutputBytes] = parsePair(
    raw.NetIO,
    'Docker network I/O',
    parseByteValue,
  );
  return {
    containerId: raw.ID,
    name: raw.Name,
    cpuPercent,
    memoryUsageBytes,
    memoryLimitBytes,
    networkInputBytes,
    networkOutputBytes,
  };
}

export function parsePostgresConnectionCount(stdout) {
  if (typeof stdout !== 'string' || !/^(0|[1-9]\d*)\r?\n?$/.test(stdout)) {
    throw new TypeError('Invalid PostgreSQL connection count');
  }
  return boundedNumber(Number(stdout.trim()), 'PostgreSQL connection count', {
    integer: true,
  });
}

export function parsePostgresStatus(stdout) {
  if (typeof stdout !== 'string')
    throw new TypeError('Invalid PostgreSQL status');
  const match = /^(0|[1-9]\d*)\|(0|[1-9]\d*)\r?\n?$/.exec(stdout);
  if (!match) throw new TypeError('Invalid PostgreSQL status');
  return {
    connectionCount: boundedNumber(
      Number(match[1]),
      'PostgreSQL connection count',
      {
        integer: true,
      },
    ),
    persistentErrors: boundedNumber(
      Number(match[2]),
      'PostgreSQL persistent errors',
      {
        integer: true,
      },
    ),
  };
}

function parseRedisFields(stdout, requiredFields) {
  if (typeof stdout !== 'string')
    throw new TypeError('Invalid Redis INFO response');
  const values = new Map();
  const names = requiredFields.join('|');
  const linePattern = new RegExp(`^(${names}):(0|[1-9]\\d*)$`);
  for (const line of stdout.split(/\r?\n/)) {
    const match = linePattern.exec(line);
    if (!match) continue;
    if (values.has(match[1]))
      throw new TypeError('Invalid Redis INFO response');
    values.set(match[1], Number(match[2]));
  }
  if (requiredFields.some((field) => !values.has(field))) {
    throw new TypeError('Invalid Redis INFO response');
  }
  return values;
}

export function parseRedisInfo(stdout) {
  const values = parseRedisFields(stdout, ['connected_clients', 'used_memory']);
  return {
    connectedClients: boundedNumber(
      values.get('connected_clients'),
      'Redis connected clients',
      { integer: true },
    ),
    usedMemoryBytes: boundedNumber(
      values.get('used_memory'),
      'Redis used memory',
      { integer: true },
    ),
  };
}

export function parseRedisStatus(stdout) {
  const values = parseRedisFields(stdout, [
    'connected_clients',
    'used_memory',
    'rejected_connections',
  ]);
  return {
    connectedClients: boundedNumber(
      values.get('connected_clients'),
      'Redis connected clients',
      { integer: true },
    ),
    usedMemoryBytes: boundedNumber(
      values.get('used_memory'),
      'Redis used memory',
      {
        integer: true,
      },
    ),
    rejectedConnections: boundedNumber(
      values.get('rejected_connections'),
      'Redis rejected connections',
      { integer: true },
    ),
  };
}

export function parseDockerInspectIdentity(line) {
  if (typeof line !== 'string')
    throw new TypeError('Invalid Docker inspect identity');
  const fields = line.split('\t');
  if (fields.length !== 4)
    throw new TypeError('Invalid Docker inspect identity');
  let values;
  try {
    values = fields.map((field) => JSON.parse(field));
  } catch {
    throw new TypeError('Invalid Docker inspect identity');
  }
  const [containerId, restartCount, project, service] = values;
  if (
    !validContainerId(containerId) ||
    !Number.isSafeInteger(restartCount) ||
    restartCount < 0 ||
    project !== 'auth-load' ||
    !SERVICES.includes(service)
  ) {
    throw new TypeError('Invalid Docker inspect identity');
  }
  return { containerId, restartCount, project, service };
}

function parseJsonRecords(stdout, label) {
  if (typeof stdout !== 'string' || stdout.trim() === '')
    throw new TypeError(`Invalid ${label}`);
  try {
    const trimmed = stdout.trim();
    const records = trimmed.startsWith('[')
      ? JSON.parse(trimmed)
      : trimmed.split(/\r?\n/).map((line) => JSON.parse(line));
    if (
      !Array.isArray(records) ||
      records.some((record) => !record || typeof record !== 'object')
    ) {
      throw new Error();
    }
    return records;
  } catch {
    throw new TypeError(`Invalid ${label}`);
  }
}

async function requiredCommand(deps, args, phase) {
  let result;
  try {
    result = await deps.runCommand('docker', args, { captureStdout: true });
  } catch {
    throw new Error(`Monitor command failed during ${phase}`);
  }
  if (!result || result.exitCode !== 0 || typeof result.stdout !== 'string') {
    throw new Error(`Monitor command failed during ${phase}`);
  }
  return result.stdout;
}

function resolveComposeRows(stdout) {
  const rows = parseJsonRecords(stdout, 'dedicated service containers');
  const byService = new Map();
  for (const row of rows) {
    if (
      row.Project !== 'auth-load' ||
      !COMPOSE_SERVICES.has(row.Service) ||
      !CONTAINER_STATES.has(row.State) ||
      !validContainerId(row.ID) ||
      typeof row.Name !== 'string' ||
      !/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(row.Name)
    ) {
      throw new Error('Invalid dedicated service containers');
    }
    if (!SERVICES.includes(row.Service)) continue;
    if (byService.has(row.Service))
      throw new Error('Invalid dedicated service containers');
    byService.set(row.Service, {
      ...row,
      status: row.State === 'running' ? 'running' : 'stopped',
    });
  }
  return byService;
}

function resolveQuietIds(stdout, composeRows) {
  const ids = stdout.trim().split(/\r?\n/).filter(Boolean);
  const expectedIds = SERVICES.flatMap((service) => {
    const row = composeRows.get(service);
    return row ? [row.ID] : [];
  });
  if (
    ids.length !== expectedIds.length ||
    new Set(ids).size !== expectedIds.length ||
    ids.some((id) => !validContainerId(id))
  ) {
    throw new Error('Invalid dedicated service container IDs');
  }
  const expected = new Set(expectedIds);
  if (ids.some((id) => !expected.has(id)))
    throw new Error('Invalid dedicated service container IDs');
  return expectedIds;
}

function parseInspectRecords(stdout, expectedIds, composeRows) {
  if (typeof stdout !== 'string' || stdout.trim() === '') {
    throw new Error('Invalid Docker inspect response');
  }
  const records = stdout.trim().split(/\r?\n/).map(parseDockerInspectIdentity);
  if (records.length !== expectedIds.length)
    throw new Error('Invalid Docker inspect response');
  const byService = new Map();
  for (const record of records) {
    const service = record.service;
    if (
      record.project !== 'auth-load' ||
      !SERVICES.includes(service) ||
      !expectedIds.includes(record.containerId) ||
      composeRows.get(service)?.ID !== record.containerId ||
      byService.has(service)
    ) {
      throw new Error('Invalid Docker inspect response');
    }
    byService.set(service, record.restartCount);
  }
  if (byService.size !== expectedIds.length)
    throw new Error('Invalid Docker inspect response');
  return byService;
}

function parseStatsRecords(stdout, ids, composeRows) {
  const records = parseJsonRecords(stdout, 'Docker stats response').map(
    (record) => parseDockerStats(JSON.stringify(record)),
  );
  if (records.length !== ids.length)
    throw new Error('Invalid Docker stats response');
  const byService = new Map();
  for (const sample of records) {
    const matches = ids.filter((id) => id.startsWith(sample.containerId));
    if (matches.length !== 1) throw new Error('Invalid Docker stats response');
    const id = matches[0];
    const service = SERVICES.find(
      (candidate) => composeRows.get(candidate).ID === id,
    );
    if (
      !service ||
      composeRows.get(service).Name !== sample.name ||
      byService.has(service)
    ) {
      throw new Error('Invalid Docker stats response');
    }
    byService.set(service, sample);
  }
  if (byService.size !== ids.length)
    throw new Error('Invalid Docker stats response');
  return byService;
}

async function dependencyCommand(deps, args, state) {
  let result;
  try {
    result = await deps.runCommand('docker', args, { captureStdout: true });
  } catch {
    state.probeFailures += 1;
    return undefined;
  }
  if (!result || !Number.isSafeInteger(result.exitCode)) {
    throw new Error('Invalid dependency probe result');
  }
  if (result.exitCode !== 0) {
    state.probeFailures += 1;
    return undefined;
  }
  if (typeof result.stdout !== 'string')
    throw new Error('Invalid dependency probe result');
  return result.stdout;
}

function baselineDelta(state, name, value) {
  const baselineName = `${name}Baseline`;
  const lastName = `${name}Last`;
  if (state[baselineName] === undefined) {
    state[baselineName] = value;
    state[lastName] = value;
    return 0;
  }
  if (value < state[lastName]) {
    throw new Error('Persistent dependency counter reset');
  }
  state[lastName] = value;
  return value - state[baselineName];
}

async function collectSample(deps, outputPath, samples, dependencyState) {
  const composeRows = resolveComposeRows(
    await requiredCommand(
      deps,
      [...COMPOSE_ARGS, 'ps', '--all', '--format', 'json'],
      'container discovery',
    ),
  );
  const ids = resolveQuietIds(
    await requiredCommand(
      deps,
      [...COMPOSE_ARGS, 'ps', '--all', '-q', ...SERVICES],
      'container ID discovery',
    ),
    composeRows,
  );
  const runningIds = ids.filter((id) =>
    [...composeRows.values()].some(
      (row) => row.ID === id && row.status === 'running',
    ),
  );
  const stats =
    runningIds.length === 0
      ? new Map()
      : parseStatsRecords(
          await requiredCommand(
            deps,
            ['stats', '--no-stream', '--format', '{{json .}}', ...runningIds],
            'Docker stats',
          ),
          runningIds,
          composeRows,
        );
  const restarts =
    ids.length === 0
      ? new Map()
      : parseInspectRecords(
          await requiredCommand(
            deps,
            ['inspect', '--format', INSPECT_IDENTITY_FORMAT, ...ids],
            'Docker inspect',
          ),
          ids,
          composeRows,
        );
  const postgresRunning =
    composeRows.get('postgres-load')?.status === 'running';
  if (!postgresRunning) {
    dependencyState.probeFailures += 1;
    dependencyState.postgresConnections ??= 0;
  }
  const postgresStdout = postgresRunning
    ? await dependencyCommand(
        deps,
        [
          ...COMPOSE_ARGS,
          'exec',
          '-T',
          'postgres-load',
          'psql',
          '-U',
          'postgres',
          '-d',
          'auth_load',
          '-Atc',
          "select count(*) || '|' || coalesce((select sessions_abandoned + sessions_fatal + sessions_killed from pg_stat_database where datname = 'auth_load'), 0) from pg_stat_activity",
        ],
        dependencyState,
      )
    : undefined;
  if (
    postgresRunning &&
    postgresStdout === undefined &&
    dependencyState.postgresPersistentErrorsBaseline === undefined
  ) {
    throw new Error('Initial dependency probe failed');
  }
  if (postgresStdout !== undefined) {
    const postgres = parsePostgresStatus(postgresStdout);
    dependencyState.postgresConnections = postgres.connectionCount;
    dependencyState.postgresPersistentErrors = baselineDelta(
      dependencyState,
      'postgresPersistentErrors',
      postgres.persistentErrors,
    );
  }
  const redisRunning = composeRows.get('redis-load')?.status === 'running';
  if (!redisRunning) {
    dependencyState.probeFailures += 1;
    dependencyState.redis ??= {
      connectedClients: 0,
      usedMemoryBytes: 0,
      rejectedConnections: 0,
    };
  }
  const redisStdout = redisRunning
    ? await dependencyCommand(
        deps,
        [
          ...COMPOSE_ARGS,
          'exec',
          '-T',
          'redis-load',
          'redis-cli',
          'INFO',
          'clients',
          'memory',
          'stats',
        ],
        dependencyState,
      )
    : undefined;
  if (
    redisRunning &&
    redisStdout === undefined &&
    dependencyState.redisRejectedConnectionsBaseline === undefined
  ) {
    throw new Error('Initial dependency probe failed');
  }
  if (redisStdout !== undefined) {
    const redis = parseRedisStatus(redisStdout);
    dependencyState.redis = redis;
    dependencyState.redisRejectedConnections = baselineDelta(
      dependencyState,
      'redisRejectedConnections',
      redis.rejectedConnections,
    );
  }
  const dependencyErrors =
    dependencyState.probeFailures +
    dependencyState.postgresPersistentErrors +
    dependencyState.redisRejectedConnections;
  if (!Number.isSafeInteger(dependencyErrors)) {
    throw new Error('Invalid dependency error count');
  }
  const timestamp = deps.now().toISOString();
  const services = {};
  const rows = [];
  for (const service of SERVICES) {
    const composeRow = composeRows.get(service);
    const status = composeRow?.status ?? 'missing';
    const serviceStats = stats.get(service) ?? {
      containerId: composeRow?.ID,
      name: composeRow?.Name,
      cpuPercent: 0,
      memoryUsageBytes: 0,
      memoryLimitBytes: 0,
      networkInputBytes: 0,
      networkOutputBytes: 0,
    };
    const restartCount = restarts.get(service) ?? 0;
    services[service] = { status, ...serviceStats, restartCount };
    rows.push(
      [
        timestamp,
        service,
        status,
        serviceStats.cpuPercent,
        serviceStats.memoryUsageBytes,
        serviceStats.memoryLimitBytes,
        serviceStats.networkInputBytes,
        serviceStats.networkOutputBytes,
        restartCount,
        dependencyState.postgresConnections,
        dependencyState.redis?.connectedClients,
        dependencyState.redis?.usedMemoryBytes,
        dependencyState.postgresPersistentErrors,
        dependencyState.redisRejectedConnections,
        dependencyErrors,
      ].join(','),
    );
  }
  const sample = Object.freeze({
    timestamp,
    services: Object.freeze(services),
    postgresConnections: dependencyState.postgresConnections,
    redis: dependencyState.redis
      ? Object.freeze({ ...dependencyState.redis })
      : undefined,
    dependencyErrors,
  });
  samples.push(sample);
  await deps.appendFile(outputPath, `${rows.join('\n')}\n`);
}

export function summarizeMonitorSamples(samples) {
  if (!Array.isArray(samples) || samples.length < 1) {
    throw new TypeError('Invalid monitor samples');
  }
  const services = Object.fromEntries(
    SERVICES.map((service) => [
      service,
      {
        peakCpuPercent: 0,
        peakMemoryUsageBytes: 0,
        peakNetworkInputBytes: 0,
        peakNetworkOutputBytes: 0,
        maxRestartCount: 0,
        stoppedSamples: 0,
        missingSamples: 0,
      },
    ]),
  );
  let peakPostgresConnections = 0;
  let peakRedisConnectedClients = 0;
  let peakRedisUsedMemoryBytes = 0;
  let dependencyErrors = 0;
  for (const sample of samples) {
    if (!Number.isFinite(Date.parse(sample?.timestamp))) {
      throw new TypeError('Invalid monitor samples');
    }
    for (const service of SERVICES) {
      const source = sample?.services?.[service];
      if (
        !source ||
        !['running', 'stopped', 'missing'].includes(source.status)
      ) {
        throw new TypeError('Invalid monitor samples');
      }
      const target = services[service];
      target.peakCpuPercent = Math.max(
        target.peakCpuPercent,
        boundedNumber(source.cpuPercent, 'monitor CPU percentage', {
          max: 1_000_000,
        }),
      );
      target.peakMemoryUsageBytes = Math.max(
        target.peakMemoryUsageBytes,
        boundedNumber(source.memoryUsageBytes, 'monitor memory usage', {
          integer: true,
        }),
      );
      target.peakNetworkInputBytes = Math.max(
        target.peakNetworkInputBytes,
        boundedNumber(source.networkInputBytes, 'monitor network input', {
          integer: true,
        }),
      );
      target.peakNetworkOutputBytes = Math.max(
        target.peakNetworkOutputBytes,
        boundedNumber(source.networkOutputBytes, 'monitor network output', {
          integer: true,
        }),
      );
      target.maxRestartCount = Math.max(
        target.maxRestartCount,
        boundedNumber(source.restartCount, 'monitor restart count', {
          integer: true,
        }),
      );
      if (source.status === 'stopped') target.stoppedSamples += 1;
      if (source.status === 'missing') target.missingSamples += 1;
    }
    peakPostgresConnections = Math.max(
      peakPostgresConnections,
      boundedNumber(
        sample.postgresConnections,
        'monitor PostgreSQL connections',
        {
          integer: true,
        },
      ),
    );
    peakRedisConnectedClients = Math.max(
      peakRedisConnectedClients,
      boundedNumber(sample?.redis?.connectedClients, 'monitor Redis clients', {
        integer: true,
      }),
    );
    peakRedisUsedMemoryBytes = Math.max(
      peakRedisUsedMemoryBytes,
      boundedNumber(sample?.redis?.usedMemoryBytes, 'monitor Redis memory', {
        integer: true,
      }),
    );
    dependencyErrors = Math.max(
      dependencyErrors,
      boundedNumber(sample.dependencyErrors, 'monitor dependency errors', {
        integer: true,
      }),
    );
  }
  return {
    sampleCount: samples.length,
    services,
    peakPostgresConnections,
    peakRedisConnectedClients,
    peakRedisUsedMemoryBytes,
    dependencyErrors,
  };
}

export function startMonitor(deps, outputPath) {
  if (
    !deps ||
    typeof deps.runCommand !== 'function' ||
    typeof deps.writeFile !== 'function' ||
    typeof deps.appendFile !== 'function' ||
    typeof deps.now !== 'function'
  ) {
    throw new TypeError('Invalid monitor dependencies');
  }
  if (typeof outputPath !== 'string' || outputPath.length === 0)
    throw new TypeError('Invalid monitor output path');
  const schedule = deps.setInterval ?? globalThis.setInterval;
  const cancel = deps.clearInterval ?? globalThis.clearInterval;
  const samples = [];
  const dependencyState = {
    probeFailures: 0,
    postgresConnections: undefined,
    postgresPersistentErrorsBaseline: undefined,
    postgresPersistentErrorsLast: undefined,
    postgresPersistentErrors: 0,
    redis: undefined,
    redisRejectedConnectionsBaseline: undefined,
    redisRejectedConnectionsLast: undefined,
    redisRejectedConnections: 0,
  };
  let stopped = false;
  let failure;
  const initialSample = Promise.resolve()
    .then(() => deps.writeFile(outputPath, `${CSV_HEADER}\n`, { mode: 0o600 }))
    .then(() => collectSample(deps, outputPath, samples, dependencyState));
  let pending = initialSample.catch((error) => {
    failure ??= error;
  });
  function enqueueSample() {
    pending = pending
      .then(() => {
        if (failure) return undefined;
        return collectSample(deps, outputPath, samples, dependencyState);
      })
      .catch((error) => {
        failure ??= error;
      });
    return pending;
  }
  const interval = schedule(() => {
    if (stopped || failure) return;
    enqueueSample();
  }, 5_000);

  return Object.freeze({
    ready() {
      return initialSample;
    },
    snapshot() {
      if (failure) throw failure;
      return samples.slice();
    },
    async checkpoint() {
      if (stopped) throw new Error('Monitor is stopped');
      await enqueueSample();
      if (failure) throw failure;
    },
    async stop() {
      if (!stopped) {
        stopped = true;
        cancel(interval);
      }
      await pending;
      if (failure) throw failure;
    },
  });
}
