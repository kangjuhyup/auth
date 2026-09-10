export abstract class IdempotencyKeyHashPort {
  abstract hash(value: string): string;
}
