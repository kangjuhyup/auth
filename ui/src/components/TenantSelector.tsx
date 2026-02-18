import { useEffect } from 'react';
import { Select, Space, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useTenantStore } from '@/stores/tenant.store';
import { queryKeys } from '@/lib/queryKeys';
import { tenantApi } from '@/features/tenants/api/tenantApi';

const { Text } = Typography;

export function TenantSelector() {
  const { selectedTenant, setTenant } = useTenantStore();

  // Query all tenants for selection
  const { data: tenantsData } = useQuery({
    queryKey: queryKeys.admin.tenants.list({}),
    queryFn: () => tenantApi.list({ page: 1, limit: 100 }),
  });

  const tenants = tenantsData?.items ?? [];

  // Auto-select first tenant if none selected
  useEffect(() => {
    if (!selectedTenant && tenants.length > 0) {
      setTenant(tenants[0]);
    }
  }, [selectedTenant, tenants, setTenant]);

  return (
    <Space>
      <Text type="secondary">Tenant:</Text>
      <Select
        value={selectedTenant?.id}
        onChange={(tenantId) => {
          const tenant = tenants.find((t) => t.id === tenantId);
          if (tenant) {
            setTenant(tenant);
          }
        }}
        style={{ minWidth: 200 }}
        placeholder="Select tenant"
        options={tenants.map((t) => ({
          label: t.name,
          value: t.id,
        }))}
      />
    </Space>
  );
}
