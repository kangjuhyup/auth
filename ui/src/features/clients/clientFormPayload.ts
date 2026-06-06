import type { UpdateClientDto } from '@/types/client.types';

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
  return dto;
}
