export type HealthState = 'ok';
export type ReadinessState = 'ready' | 'not_ready';
export type ReadinessComponentState = 'ready' | 'not_ready';

export type OperationalMetricLabel = string | number | boolean | null;
export type OperationalMetricLabels = Readonly<
  Record<string, OperationalMetricLabel>
>;

export class HealthStatusDto {
  private constructor(
    readonly status: HealthState,
    readonly uptimeSec: number,
  ) {}

  static of(params: {
    status: HealthState;
    uptimeSec: number;
  }): HealthStatusDto {
    return new HealthStatusDto(params.status, params.uptimeSec);
  }
}

export class ReadinessComponentDto {
  private constructor(
    readonly name: string,
    readonly status: ReadinessComponentState,
    readonly latencyMs: number,
    readonly reason: string | null,
  ) {}

  static of(params: {
    name: string;
    status: ReadinessComponentState;
    latencyMs: number;
    reason?: string | null;
  }): ReadinessComponentDto {
    return new ReadinessComponentDto(
      params.name,
      params.status,
      params.latencyMs,
      params.reason ?? null,
    );
  }
}

export class ReadinessStatusDto {
  private constructor(
    readonly status: ReadinessState,
    readonly components: ReadinessComponentDto[],
  ) {}

  static of(params: {
    status: ReadinessState;
    components: ReadinessComponentDto[];
  }): ReadinessStatusDto {
    return new ReadinessStatusDto(params.status, params.components);
  }
}

export class OperationalCounterDto {
  private constructor(
    readonly name: string,
    readonly value: number,
    readonly labels: OperationalMetricLabels,
  ) {}

  static of(params: {
    name: string;
    value: number;
    labels?: OperationalMetricLabels;
  }): OperationalCounterDto {
    return new OperationalCounterDto(
      params.name,
      params.value,
      params.labels ?? {},
    );
  }
}

export class OperationalLatencyDto {
  private constructor(
    readonly name: string,
    readonly count: number,
    readonly sumMs: number,
    readonly avgMs: number,
    readonly maxMs: number,
    readonly labels: OperationalMetricLabels,
  ) {}

  static of(params: {
    name: string;
    count: number;
    sumMs: number;
    avgMs: number;
    maxMs: number;
    labels?: OperationalMetricLabels;
  }): OperationalLatencyDto {
    return new OperationalLatencyDto(
      params.name,
      params.count,
      params.sumMs,
      params.avgMs,
      params.maxMs,
      params.labels ?? {},
    );
  }
}

export class OperationalMetricsSnapshotDto {
  private constructor(
    readonly counters: OperationalCounterDto[],
    readonly latencies: OperationalLatencyDto[],
  ) {}

  static of(params: {
    counters: OperationalCounterDto[];
    latencies: OperationalLatencyDto[];
  }): OperationalMetricsSnapshotDto {
    return new OperationalMetricsSnapshotDto(params.counters, params.latencies);
  }
}
