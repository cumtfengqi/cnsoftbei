import { useState } from 'react';
import { Layout, Button } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import SideMenu from './components/SideMenu';
import Home from './pages/Home';
import Profile from './pages/Profile';
import Resources from './pages/Resources';
import Path from './pages/Path';
import Tutor from './pages/Tutor';
import Assessment from './pages/Assessment';
import './App.css';

const { Header, Content } = Layout;

function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [selectedKey, setSelectedKey] = useState('home');

  const renderPage = () => {
    switch (selectedKey) {
      case 'home':
        return <Home />;
      case 'profile':
        return <Profile />;
      case 'resources':
        return <Resources />;
      case 'path':
        return <Path />;
      case 'tutor':
        return <Tutor />;
      case 'assessment':
        return <Assessment />;
      default:
        return <Home />;
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <SideMenu
        collapsed={collapsed}
        selectedKey={selectedKey}
        onMenuSelect={setSelectedKey}
      />
      <Layout>
        <Header style={{
          padding: '0 24px',
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{ fontSize: 16, width: 64, height: 64 }}
          />
          <div style={{ fontWeight: 'bold', color: '#1890ff', fontSize: 16 }}>
            第十五届中国软件杯 - A3赛题
          </div>
        </Header>
        <Content style={{ margin: 0, background: '#f0f2f5' }}>
          {renderPage()}
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;
