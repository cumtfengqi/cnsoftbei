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

const { Sider } = Layout;

interface SideMenuProps {
  collapsed: boolean;
  selectedKey: string;
  onMenuSelect: (key: string) => void;
}

const SideMenu: React.FC<SideMenuProps> = ({ collapsed, selectedKey, onMenuSelect }) => {
  const items = [
    { key: 'home', icon: <HomeOutlined />, label: '首页' },
    { key: 'profile', icon: <UserOutlined />, label: '学习画像' },
    { key: 'resources', icon: <FileTextOutlined />, label: '资源生成' },
    { key: 'path', icon: <AimOutlined />, label: '学习路径' },
    { key: 'tutor', icon: <QuestionCircleOutlined />, label: '智能辅导' },
    { key: 'assessment', icon: <DashboardOutlined />, label: '效果评估' },
  ];

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
