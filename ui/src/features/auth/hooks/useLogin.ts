import { useMutation } from '@tanstack/react-query';
import { message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { authApi } from '../api/authApi';
import type { LoginDto } from '@/types/auth.types';

export function useLogin() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  return useMutation({
    mutationFn: (dto: LoginDto) => authApi.login(dto),
    onSuccess: (data) => {
      login(data.username, data.token);
      message.success('Login successful');
      navigate('/admin/tenants');
    },
    onError: (error: Error) => {
      message.error(error.message || 'Login failed');
    },
  });
}
