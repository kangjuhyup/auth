import type {
  GrantTypeDefinition,
  GrantTypeValidationIssue,
  GrantTypeValidationParams,
} from '@application/ports/grant-type-registry.port';

export interface GrantTypeValidationContext {
  definition: GrantTypeDefinition;
  params: GrantTypeValidationParams;
  selectedGrantTypes: ReadonlySet<string>;
}

export interface GrantTypeValidationStrategy {
  validate(context: GrantTypeValidationContext): GrantTypeValidationIssue[];
}
