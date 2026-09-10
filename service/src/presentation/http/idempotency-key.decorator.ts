import {
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._~-]{16,128}$/;

export const IdempotencyKey = createParamDecorator(
  (_: unknown, context: ExecutionContext): string => {
    const value = context.switchToHttp().getRequest<Request>().headers[
      'idempotency-key'
    ];
    if (typeof value !== 'string' || !IDEMPOTENCY_KEY_PATTERN.test(value)) {
      throw new BadRequestException('Invalid Idempotency-Key');
    }
    return value;
  },
);
