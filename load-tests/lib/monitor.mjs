const COMPOSE_ARGS = Object.freeze([
  'compose',
  '--project-name',
  'auth-load',
  '-f',
  'docker-compose.load.yml',
]);
const SERVICES = Object.freeze(['auth-service', 'postgres-load', 'redis-load']);
const INSPECT_IDENTITY_FORMAT = [
  '{{json .Id}}',
  '{{json .RestartCount}}',
  '{{json (index .Config.Labels "com.docker.compose.project")}}',
  '{{json (index .Config.Labels "com.docker.compose.service")}}',
].join('\t');
const CSV_HEADER = [
  'timestamp',
  'service',
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
    if (!SERVICES.includes(row.Service)) continue;
    if (
      row.Project !== 'auth-load' ||
      row.State !== 'running' ||
      !validContainerId(row.ID)
    ) {
      throw new Error('Invalid dedicated service containers');
    }
    if (byService.has(row.Service))
      throw new Error('Invalid dedicated service containers');
    byService.set(row.Service, row);
  }
  if (byService.size !== SERVICES.length) {
    throw new Error('Invalid dedicated service containers');
  }
  return byService;
}

function resolveQuietIds(stdout, composeRows) {
  const ids = stdout.trim().split(/\r?\n/).filter(Boolean);
  if (
    ids.length !== SERVICES.length ||
    new Set(ids).size !== SERVICES.length ||
    ids.some((id) => !validContainerId(id))
  ) {
    throw new Error('Invalid dedicated service container IDs');
  }
  const expected = new Set(
    SERVICES.map((service) => composeRows.get(service).ID),
  );
  if (ids.some((id) => !expected.has(id)))
    throw new Error('Invalid dedicated service container IDs');
  return SERVICES.map((service) => composeRows.get(service).ID);
}

function parseInspectRecords(stdout, expectedIds) {
  if (typeof stdout !== 'string' || stdout.trim() === '') {
    throw new Error('Invalid Docker inspect response');
  }
  const records = stdout.trim().split(/\r?\n/).map(parseDockerInspectIdentity);
  if (records.length !== SERVICES.length)
    throw new Error('Invalid Docker inspect response');
  const byService = new Map();
  for (const record of records) {
    const service = record.service;
    if (
      record.project !== 'auth-load' ||
      !SERVICES.includes(service) ||
      !expectedIds.includes(record.containerId) ||
      byService.has(service)
    ) {
      throw new Error('Invalid Docker inspect response');
    }
    byService.set(service, record.restartCount);
  }
  if (byService.size !== SERVICES.length)
    throw new Error('Invalid Docker inspect response');
  return byService;
}

function parseStatsRecords(stdout, ids, composeRows) {
  const records = parseJsonRecords(stdout, 'Docker stats response').map(
    (record) => parseDockerStats(JSON.stringify(record)),
  );
  if (records.length !== SERVICES.length)
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
  if (byService.size !== SERVICES.length)
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

async function collectSample(deps, outputPath, samples, dependencyState) {
  const composeRows = resolveComposeRows(
    await requiredCommand(
      deps,
      [...COMPOSE_ARGS, 'ps', '--format', 'json'],
      'container discovery',
    ),
  );
  const ids = resolveQuietIds(
    await requiredCommand(
      deps,
      [...COMPOSE_ARGS, 'ps', '-q', ...SERVICES],
      'container ID discovery',
    ),
    composeRows,
  );
  const stats = parseStatsRecords(
    await requiredCommand(
      deps,
      ['stats', '--no-stream', '--format', '{{json .}}', ...ids],
      'Docker stats',
    ),
    ids,
    composeRows,
  );
  const restarts = parseInspectRecords(
    await requiredCommand(
      deps,
      ['inspect', '--format', INSPECT_IDENTITY_FORMAT, ...ids],
      'Docker inspect',
    ),
    ids,
  );
  const postgresStdout = await dependencyCommand(
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
  );
  if (postgresStdout !== undefined) {
    const postgres = parsePostgresStatus(postgresStdout);
    dependencyState.postgresConnections = postgres.connectionCount;
    dependencyState.postgresPersistentErrors = Math.max(
      dependencyState.postgresPersistentErrors,
      postgres.persistentErrors,
    );
  }
  const redisStdout = await dependencyCommand(
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
  );
  if (redisStdout !== undefined) {
    const redis = parseRedisStatus(redisStdout);
    dependencyState.redis = redis;
    dependencyState.redisRejectedConnections = Math.max(
      dependencyState.redisRejectedConnections,
      redis.rejectedConnections,
    );
  }
  const dependencyErrors =
    dependencyState.probeFailures +
    dependencyState.postgresPersistentErrors +
    dependencyState.redisRejectedConnections;
  const timestamp = deps.now().toISOString();
  const services = {};
  const rows = [];
  for (const service of SERVICES) {
    const serviceStats = stats.get(service);
    const restartCount = restarts.get(service);
    services[service] = { ...serviceStats, restartCount };
    rows.push(
      [
        timestamp,
        service,
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
    postgresPersistentErrors: 0,
    redis: undefined,
    redisRejectedConnections: 0,
  };
  let stopped = false;
  let failure;
  let pending = Promise.resolve()
    .then(() => deps.writeFile(outputPath, `${CSV_HEADER}\n`, { mode: 0o600 }))
    .then(() => collectSample(deps, outputPath, samples, dependencyState))
    .catch((error) => {
      failure = error;
    });
  const interval = schedule(() => {
    if (stopped || failure) return;
    pending = pending
      .then(() => collectSample(deps, outputPath, samples, dependencyState))
      .catch((error) => {
        failure = error;
      });
  }, 5_000);

  return Object.freeze({
    snapshot() {
      if (failure) throw failure;
      return samples.slice();
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
