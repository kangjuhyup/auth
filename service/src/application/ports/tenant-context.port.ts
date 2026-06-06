import type { TenantContext } from '@application/dto';

export abstract class TenantContextPort {
  abstract findByCode(code: string): Promise<TenantContext | null>;
}
