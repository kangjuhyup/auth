import type { CustomGrantTypeDefinition } from './custom-grant-type';

export const CUSTOM_GRANT_TYPES: CustomGrantTypeDefinition[] = [];

export type {
  CustomGrantTypeContext,
  CustomGrantTypeDefinition,
  CustomGrantTypeHandler,
  CustomGrantTypeParameters,
} from './custom-grant-type';
