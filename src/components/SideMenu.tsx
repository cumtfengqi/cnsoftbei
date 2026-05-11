import React from 'react';
import { Layout, Menu } from 'antd';
import {
  UserOutlined,
  FileTextOutlined,
  AimOutlined,
  QuestionCircleOutlined,
  DashboardOutlined,
  HomeOutlined,
} from '@ant-design/icons';
import { menuItems as menuData } from '../data/mockData';

const { Sider } = Layout;

// 图标名字符串到组件的映射
const iconComponentMap: Record<string, React.ReactNode> = {
  HomeOutlined: <HomeOutlined />,
  UserOutlined: <UserOutlined />,
  FileTextOutlined: <FileTextOutlined />,
  AimOutlined: <AimOutlined />,
  QuestionCircleOutlined: <QuestionCircleOutlined />,
  DashboardOutlined: <DashboardOutlined />,
};

interface SideMenuProps {
  collapsed: boolean;
  selectedKey: string;
  onMenuSelect: (key: string) => void;
}

const SideMenu: React.FC<SideMenuProps> = ({ collapsed, selectedKey, onMenuSelect }) => {
  const items = menuData.map(item => ({
    key: item.key,
    icon: iconComponentMap[item.iconName] || null,
    label: item.label,
  }));

  return (
    <Sider collapsible collapsed={collapsed} trigger={null} style={{ minHeight: '100vh' }}>
      <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18, fontWeight: 'bold' }}>
        {collapsed ? 'AI' : '学习智能体'}
      </div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[selectedKey]}
        onClick={({ key }) => onMenuSelect(key)}
        items={items}
      />
    </Sider>
  );
};

export default SideMenu;
