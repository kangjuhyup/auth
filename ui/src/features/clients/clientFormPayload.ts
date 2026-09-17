import type { CreateClientDto, UpdateClientDto } from '@/types/client.types';

type ClientFormValues = UpdateClientDto & {
  id?: string;
  clientId?: string;
  type?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export function toUpdateClientDto(values: ClientFormValues): UpdateClientDto {
  const { id, clientId, type, createdAt, updatedAt, ...dto } = values;
  void id;
  void clientId;
  void type;
  void createdAt;
  void updatedAt;
  return {
    ...dto,
    externalInteractionUiUrl: normalizeOptionalUrl(
      dto.externalInteractionUiUrl,
      null,
    ),
  };
}

export function toCreateClientDto(values: CreateClientDto): CreateClientDto {
  return {
    ...values,
    externalInteractionUiUrl: normalizeOptionalUrl(
      values.externalInteractionUiUrl,
      undefined,
    ),
  };
}

function normalizeOptionalUrl<T extends null | undefined>(
  value: string | null | undefined,
  emptyValue: T,
): string | T {
  const trimmed = value?.trim();
  return trimmed ? trimmed : emptyValue;
}
