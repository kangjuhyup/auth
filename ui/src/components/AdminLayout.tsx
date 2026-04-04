import { Layout, Menu, Button, Space, Typography } from 'antd';
import {
  TeamOutlined,
  UserOutlined,
  SafetyOutlined,
  AppstoreOutlined,
  ClusterOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useUiStore } from '@/stores/ui.store';
import { useAuthStore } from '@/stores/auth.store';
import { authApi } from '@/features/auth/api/authApi';
import { TenantSelector } from './TenantSelector';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

export function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sidebarCollapsed, toggleSidebar } = useUiStore();
  const { clearAuth, username } = useAuthStore();

  const menuItems = [
    {
      key: '/admin/tenants',
      icon: <AppstoreOutlined />,
      label: 'Tenants',
    },
    {
      key: '/admin/clients',
      icon: <SafetyOutlined />,
      label: 'Clients',
    },
    {
      key: '/admin/roles',
      icon: <TeamOutlined />,
      label: 'Roles',
    },
    {
      key: '/admin/groups',
      icon: <ClusterOutlined />,
      label: 'Groups',
    },
    {
      key: '/admin/users',
      icon: <UserOutlined />,
      label: 'Users',
    },
  ];

  const handleLogout = async () => {
    await authApi.logout().catch(() => {});
    clearAuth();
    navigate('/login');
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={sidebarCollapsed}
        onCollapse={toggleSidebar}
        theme="dark"
      >
        <div
          style={{
            height: 32,
            margin: 16,
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold',
          }}
        >
          {!sidebarCollapsed && 'Auth Server'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>

      <Layout>
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          <TenantSelector />

          <Space>
            <Text type="secondary">
              <UserOutlined /> {username}
            </Text>
            <Button
              type="text"
              icon={<LogoutOutlined />}
              onClick={handleLogout}
            >
              Logout
            </Button>
          </Space>
        </Header>

        <Content style={{ margin: '24px', padding: 24, background: '#fff' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
