import { useEffect } from 'react';
import { Spin } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { Navigate, useLocation } from 'react-router-dom';
import { authApi } from '@/features/auth/api/authApi';
import { queryKeys } from '@/lib/queryKeys';
import { useAuthStore } from '@/stores/auth.store';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation();
  const { clearAuth, isAuthenticated, login, passwordChangeRequired } =
    useAuthStore();
  const sessionQuery = useQuery({
    queryKey: queryKeys.auth.adminSession,
    queryFn: authApi.getSession,
    retry: false,
    enabled: !isAuthenticated,
  });

  useEffect(() => {
    if (sessionQuery.data) {
      login(
        sessionQuery.data.username,
        sessionQuery.data.passwordChangeRequired,
      );
    }
  }, [login, sessionQuery.data]);

  useEffect(() => {
    if (sessionQuery.isError) {
      clearAuth();
    }
  }, [clearAuth, sessionQuery.isError]);

  if (!isAuthenticated) {
    if (sessionQuery.isLoading || sessionQuery.data) {
      return <Spin fullscreen />;
    }

    return <Navigate to="/login" replace />;
  }

  if (passwordChangeRequired && location.pathname !== '/password-change') {
    return <Navigate to="/password-change" replace />;
  }

  return <>{children}</>;
}
