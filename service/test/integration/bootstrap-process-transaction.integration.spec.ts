import { Entity, MikroORM, PrimaryKey, RequestContext } from '@mikro-orm/core';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { BootstrapStepRunner } from '@application/process-managers/bootstrap-step-runner';
import { BootstrapProcessOrmEntity } from '@infrastructure/mikro-orm/entities/bootstrap-process';
import { BootstrapProcessRepositoryImpl } from '@infrastructure/repositories/bootstrap-process.repository.impl';

const connectionUrl = process.env.BOOTSTRAP_POSTGRES_TEST_URL;
const describeWithPostgres = connectionUrl ? describe : describe.skip;

@Entity({ tableName: 'step_write' })
class StepWriteOrmEntity {
  @PrimaryKey({ type: 'varchar', length: 64 })
  id!: string;
}

describeWithPostgres('bootstrap process transaction (PostgreSQL)', () => {
  const schemaName = `bootstrap_transaction_${process.pid}_${Date.now()}`;
  let orm: MikroORM<PostgreSqlDriver>;

  beforeAll(async () => {
    orm = await MikroORM.init<PostgreSqlDriver>({
      driver: PostgreSqlDriver,
      clientUrl: connectionUrl,
      schema: schemaName,
      entities: [BootstrapProcessOrmEntity, StepWriteOrmEntity],
      allowGlobalContext: true,
    });
    const connection = orm.em.getConnection();
    await connection.execute(`create schema "${schemaName}"`);
    await connection.execute(`
      create table "${schemaName}"."bootstrap_process" (
        "process_key" varchar(128) primary key,
        "step" varchar(64) not null,
        "status" varchar(16) not null,
        "retry_count" integer not null default 0,
        "last_failure_code" varchar(64) null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now()
      )
    `);
    await connection.execute(`
      create table "${schemaName}"."step_write" (
        "id" varchar(64) primary key
      )
    `);
  });

  afterAll(async () => {
    if (!orm) {
      return;
    }
    await orm.em
      .getConnection()
      .execute(`drop schema if exists "${schemaName}" cascade`);
    await orm.close(true);
  });

  it('rolls back a command-side write before persisting the safe failure state', async () => {
    const repository = new BootstrapProcessRepositoryImpl(orm);
    const runner = new BootstrapStepRunner(repository);

    await expect(
      runner.run({
        processKey: 'bootstrap:transaction-regression:v1',
        initialStep: 'write',
        expectedStep: 'write',
        nextStep: 'completed',
        steps: ['write', 'completed'],
        work: async () => {
          const em = RequestContext.getEntityManager();
          if (!em) {
            throw new Error('Request context missing');
          }
          const write = em.create(StepWriteOrmEntity, {
            id: 'partial-write',
          });
          await em.persistAndFlush(write);
          throw new Error('non-database failure after write');
        },
      }),
    ).rejects.toMatchObject({
      code: 'BOOTSTRAP_STEP_FAILED',
      message: 'BOOTSTRAP_STEP_FAILED',
    });

    const [writeCount] = await orm.em
      .getConnection()
      .execute<
        Array<{ count: string }>
      >(`select count(*) as "count" from "${schemaName}"."step_write"`);
    const [process] = await orm.em.getConnection().execute<
      Array<{
        status: string;
        retry_count: number;
        last_failure_code: string | null;
      }>
    >(`
      select "status", "retry_count", "last_failure_code"
      from "${schemaName}"."bootstrap_process"
      where "process_key" = 'bootstrap:transaction-regression:v1'
    `);

    expect(Number(writeCount.count)).toBe(0);
    expect(process).toEqual({
      status: 'failed',
      retry_count: 1,
      last_failure_code: 'BOOTSTRAP_STEP_FAILED',
    });
  });
});
