import { useState } from 'react';
import { Card, Typography, Tag, Space, Button, Row, Col, Steps, Progress, List, Avatar, Collapse } from 'antd';
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  PlayCircleOutlined,
  FileTextOutlined,
  PlaySquareOutlined,
  BulbOutlined,
} from '@ant-design/icons';
import { mockLearningPath, mockResources } from '../data/mockData';

const { Title, Text } = Typography;
const { Panel } = Collapse;

const Path: React.FC = () => {
  const [pathData] = useState(mockLearningPath);
  const [activeNode, setActiveNode] = useState(pathData.currentNodeId);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'in-progress':
        return <PlayCircleOutlined style={{ color: '#1890ff' }} />;
      default:
        return <ClockCircleOutlined style={{ color: '#d9d9d9' }} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#52c41a';
      case 'in-progress':
        return '#1890ff';
      default:
        return '#d9d9d9';
    }
  };

  const getResourceIcon = (type: string) => {
    switch (type) {
      case 'document':
        return <FileTextOutlined />;
      case 'quiz':
        return <PlaySquareOutlined />;
      default:
        return <FileTextOutlined />;
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>个性化学习路径</Title>
      <Text type="secondary">基于您的学习画像和目标，智能规划学习步骤与顺序</Text>

      {/* 路径概览 */}
      <Card style={{ marginTop: 24 }}>
        <Row gutter={24}>
          <Col span={16}>
            <Space direction="vertical">
              <Title level={4} style={{ marginBottom: 0 }}>{pathData.title}</Title>
              <Text type="secondary">{pathData.description}</Text>
            </Space>
          </Col>
          <Col span={8}>
            <Row gutter={16}>
              <Col span={12}>
                <Text type="secondary">预计完成时间</Text>
                <br />
                <Text strong style={{ fontSize: 18 }}>{pathData.estimatedTime}</Text>
              </Col>
              <Col span={12}>
                <Text type="secondary">当前进度</Text>
                <br />
                <Text strong style={{ fontSize: 18 }}>
                  {Math.round((pathData.nodes.filter(n => n.status === 'completed').length / pathData.nodes.length) * 100)}%
                </Text>
              </Col>
            </Row>
          </Col>
        </Row>
      </Card>

      {/* 学习步骤可视化 */}
      <Card title="学习步骤" style={{ marginTop: 24 }}>
        <Steps
          current={pathData.nodes.findIndex(n => n.id === pathData.currentNodeId)}
          items={pathData.nodes.map(node => ({
            title: node.title,
            description: node.status === 'in-progress' ? `进行中 - ${node.progress}%` : node.status === 'completed' ? '已完成' : '未开始',
            icon: getStatusIcon(node.status),
          }))}
        />
      </Card>

      {/* 学习节点详情 */}
      <Row gutter={24} style={{ marginTop: 24 }}>
        <Col span={16}>
          <Card title="学习内容">
            <Collapse
              activeKey={activeNode}
              onChange={(keys) => setActiveNode(keys[0] as string)}
            >
              {pathData.nodes.map((node) => (
                <Panel
                  key={node.id}
                  header={
                    <Space>
                      {getStatusIcon(node.status)}
                      <Text strong>{node.title}</Text>
                      {node.status === 'in-progress' && (
                        <Tag color="blue">进行中</Tag>
                      )}
                      {node.status === 'completed' && (
                        <Tag color="success">已完成</Tag>
                      )}
                    </Space>
                  }
                  extra={
                    node.status !== 'completed' && node.status !== 'in-progress' ? (
                      <Button type="primary" size="small" icon={<PlayCircleOutlined />}>
                        开始学习
                      </Button>
                    ) : node.status === 'in-progress' ? (
                      <Button size="small" icon={<PlayCircleOutlined />}>
                        继续学习
                      </Button>
                    ) : (
                      <Button size="small" icon={<BulbOutlined />}>
                        复习
                      </Button>
                    )
                  }
                >
                  {node.status === 'in-progress' && (
                    <Progress percent={node.progress} status="active" style={{ marginBottom: 16 }} />
                  )}
                  <Text type="secondary">{node.description}</Text>

                  <div style={{ marginTop: 16 }}>
                    <Text strong style={{ fontSize: 14 }}>配套资源：</Text>
                    <List
                      size="small"
                      dataSource={node.resources}
                      renderItem={resource => (
                        <List.Item>
                          <Space>
                            {getResourceIcon(resource.type)}
                            <Text>{resource.title}</Text>
                            <Tag>{resource.type === 'document' ? '文档' : resource.type === 'quiz' ? '习题' : '资料'}</Tag>
                          </Space>
                        </List.Item>
                      )}
                    />
                  </div>
                </Panel>
              ))}
            </Collapse>
          </Card>
        </Col>

        {/* 右侧：路径统计 */}
        <Col span={8}>
          <Card title="路径统计">
            <Space direction="vertical" style={{ width: '100%' }}>
              {pathData.nodes.map(node => (
                <div key={node.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space>
                      {getStatusIcon(node.status)}
                      <Text style={{ color: node.status === 'pending' ? '#999' : '#000' }}>{node.title}</Text>
                    </Space>
                    <Text type="secondary">{node.progress}%</Text>
                  </div>
                  <Progress
                    percent={node.progress}
                    showInfo={false}
                    size="small"
                    strokeColor={getStatusColor(node.status)}
                    style={{ marginTop: 4, marginBottom: 12 }}
                  />
                </div>
              ))}
            </Space>
          </Card>

          <Card title="智能推荐" style={{ marginTop: 16 }}>
            <List
              size="small"
              dataSource={[
                { title: '建议先完成"机器学习基础"的习题', reason: '巩固基础，提高实战能力' },
                { title: '推荐观看神经网络动画演示', reason: '视觉化学习，加深理解' },
                { title: '下一个知识点：梯度下降', reason: '核心算法，必须掌握' },
              ]}
              renderItem={item => (
                <List.Item>
                  <Space direction="vertical" size="small">
                    <Text>{item.title}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{item.reason}</Text>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      {/* 资源推送预览 */}
      <Card title="个性化资源推送" style={{ marginTop: 24 }}>
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          基于您的学习进度和画像，系统为您智能推送以下资源
        </Text>
        <Row gutter={16}>
          {mockResources.slice(0, 4).map(resource => (
            <Col span={6} key={resource.id}>
              <Card size="small" hoverable>
                <Card.Meta
                  avatar={
                    <Avatar shape="square" style={{ background: '#1890ff' }}>
                      {resource.type[0].toUpperCase()}
                    </Avatar>
                  }
                  title={<Text style={{ fontSize: 12 }}>{resource.title}</Text>}
                  // description={<Tag size="small" color="blue">精准推送</Tag>}
                />
              </Card>
            </Col>
          ))}
        </Row>
      </Card>
    </div>
  );
};

export default Path;
