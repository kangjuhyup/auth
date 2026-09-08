import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { Client } from 'pg';

const connectionUrl = process.env.OIDC_POSTGRES_TEST_URL;
const describeWithPostgres = connectionUrl ? describe : describe.skip;

describeWithPostgres('compiled standalone OIDC cleanup worker', () => {
  const database = `auth_cleanup_worker_${process.pid}_${Date.now()}`;
  let admin: Client;
  let client: Client;
  let child: ChildProcess | undefined;

  beforeAll(async () => {
    admin = new Client({ connectionString: connectionUrl });
    await admin.connect();
    await admin.query(`CREATE DATABASE "${database}"`);
    const url = new URL(connectionUrl!);
    url.pathname = `/${database}`;
    client = new Client({ connectionString: url.toString() });
    await client.connect();
    await client.query(`CREATE TABLE oidc_model (
      tenant_id varchar(64), kind varchar(64), id varchar(128), payload json,
      uid varchar(128), grant_id varchar(128), user_code varchar(128),
      consumed_at timestamp, expires_at timestamp, created_at timestamp,
      PRIMARY KEY(tenant_id,kind,id)
    ); CREATE TABLE oidc_session_index (
      session_id varchar(128), tenant_id varchar(64), client_id varchar(128),
      account_id varchar(128), grant_id varchar(128), expires_at timestamp, created_at timestamp,
      PRIMARY KEY(tenant_id,session_id,client_id)
    ); CREATE INDEX idx_oidc_model_expires_at ON oidc_model(expires_at);`);
    await client.query(`INSERT INTO oidc_model (tenant_id,kind,id,payload,expires_at,created_at) VALUES
      ('test','AccessToken','expired','{}',now()-interval '1 day',now()),
      ('test','AccessToken','live','{}',now()+interval '1 day',now()),
      ('test','RefreshTokenReuseGrantConflict','marker','{}',now()-interval '1 day',now())`);
  }, 15000);

  afterAll(async () => {
    if (child && child.exitCode === null && child.signalCode === null) {
      const closed = once(child, 'close');
      child.kill('SIGKILL');
      await closed;
    }
    await client?.end();
    if (admin) {
      await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
      await admin.end();
    }
  });

  it('runs without HTTP/Redis credentials, removes expired rows, and closes on SIGTERM', async () => {
    const entry = resolve(__dirname, '../../dist/worker.js');
    expect(existsSync(entry)).toBe(true); // Run service:build before this process test.
    const url = new URL(connectionUrl!);
    const env = {
      ...process.env,
      NODE_ENV: 'production',
      DB_DRIVER: 'postgresql',
      DB_HOST: url.hostname,
      DB_PORT: url.port || '5432',
      DB_NAME: database,
      DB_USER: decodeURIComponent(url.username),
      DB_PASSWORD: decodeURIComponent(url.password),
      REDIS_URL: 'redis://127.0.0.1:1',
      OIDC_CLEANUP_INTERVAL_MS: '1000',
      OIDC_CLEANUP_GRACE_MS: '1000',
    };
    child = spawn(process.execPath, [entry], {
      cwd: resolve(__dirname, '../..'),
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout?.on('data', (data) => {
      output += String(data);
    });
    child.stderr?.on('data', (data) => {
      output += String(data);
    });
    const deadline = Date.now() + 15000;
    let rows: Array<{ id: string }> = [];
    while (Date.now() < deadline) {
      rows = (await client.query('SELECT id FROM oidc_model ORDER BY id')).rows;
      if (rows.length === 2 && output.includes('OIDC cleanup completed')) break;
      if (child.exitCode !== null)
        throw new Error('Worker exited before cleanup');
      await delay(100);
    }
    expect(rows.map((row) => row.id)).toEqual(['live', 'marker']);
    expect(output).toContain('OIDC cleanup worker started');
    expect(output).toContain('OIDC cleanup completed');
    expect(output).not.toContain('Mapped {');
    const closed = once(child, 'close');
    child.kill('SIGTERM');
    const [code, signal] = await closed;
    expect(code === 0 || signal === 'SIGTERM').toBe(true);
    const sessions = await admin.query(
      'SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=$1 AND pid<>$2',
      [
        database,
        (await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid,
      ],
    );
    expect(sessions.rows[0].count).toBe(0);
  }, 25000);
});
