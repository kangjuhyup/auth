import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { queryKeys } from '@/lib/queryKeys';
import { clientApi } from '../api/clientApi';
import type { UpdateClientDto } from '@/types/client.types';

export function useUpdateClient(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: UpdateClientDto) => clientApi.update(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.clients.all,
      });
      message.success('Client updated successfully');
    },
    onError: (error: Error) => {
      message.error(`Failed to update client: ${error.message}`);
    },
  });
}
