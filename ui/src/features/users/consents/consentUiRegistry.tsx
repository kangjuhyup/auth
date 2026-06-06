import type { ReactNode } from 'react';
import { Descriptions, Tag } from 'antd';
import type { UserConsentResponse } from '@/types/user.types';

export interface ConsentUiContext {
  consent: UserConsentResponse;
  scopes: string[];
}

export interface ConsentUiDefinition {
  key: string;
  match: (context: ConsentUiContext) => boolean;
  render: (context: ConsentUiContext) => ReactNode;
}

const definitions: ConsentUiDefinition[] = [];

export function registerConsentUi(definition: ConsentUiDefinition): void {
  const existingIndex = definitions.findIndex(
    (item) => item.key === definition.key,
  );
  if (existingIndex >= 0) {
    definitions[existingIndex] = definition;
    return;
  }
  definitions.push(definition);
}

export function renderConsentUi(consent: UserConsentResponse): ReactNode {
  const scopes = parseScopes(consent.grantedScopes);
  const context = { consent, scopes };
  const definition = definitions.find((item) => item.match(context));

  return definition
    ? definition.render(context)
    : renderDefaultConsentUi(context);
}

export function parseScopes(grantedScopes: string): string[] {
  return grantedScopes
    .split(/\s+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

function renderDefaultConsentUi({ consent, scopes }: ConsentUiContext) {
  return (
    <Descriptions size="small" column={1} bordered>
      <Descriptions.Item label="Client">{consent.clientName}</Descriptions.Item>
      <Descriptions.Item label="Client ID">
        {consent.clientId}
      </Descriptions.Item>
      <Descriptions.Item label="Scopes">
        {scopes.length > 0
          ? scopes.map((scope) => <Tag key={scope}>{scope}</Tag>)
          : '-'}
      </Descriptions.Item>
    </Descriptions>
  );
}
