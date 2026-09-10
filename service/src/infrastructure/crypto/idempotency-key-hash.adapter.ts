import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { IdempotencyKeyHashPort } from '@application/ports/idempotency-key-hash.port';

@Injectable()
export class IdempotencyKeyHashAdapter extends IdempotencyKeyHashPort {
  hash(value: string): string {
    return createHash('sha256').update(value, 'utf8').digest('hex');
  }
}
