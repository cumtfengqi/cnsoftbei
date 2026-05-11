import { Card, Row, Col, Statistic, Progress, Typography, Tag, Space, Avatar, List } from 'antd';
import {
  FileTextOutlined,
  FireOutlined,
  ClockCircleOutlined,
  RiseOutlined,
} from '@ant-design/icons';
import { initialProfile, mockLearningPath, mockAssessments, homeStats, agentStatusList } from '../data/mockData';

const { Title, Text } = Typography;

const Home: React.FC = () => {
  const currentNode = mockLearningPath.nodes.find(n => n.id === mockLearningPath.currentNodeId);

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>欢迎回来，{initialProfile.name}</Title>
      <Text type="secondary" style={{ fontSize: 16 }}>
        专业：{initialProfile.major} | 年级：{initialProfile.grade}
      </Text>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginTop: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="已完成学习节点"
              value={mockLearningPath.nodes.filter(n => n.status === 'completed').length}
              suffix={`/ ${mockLearningPath.nodes.length}`}
              prefix={<FireOutlined style={{ color: '#52c41a' }} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已生成资源"
              value={homeStats.resourcesGenerated}
              prefix={<FileTextOutlined style={{ color: '#1890ff' }} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="学习效率指数"
              value={homeStats.efficiencyScore}
              suffix="分"
              prefix={<RiseOutlined style={{ color: '#faad14' }} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="预计完成时间"
              value={homeStats.estimatedWeeks}
              suffix="周"
              prefix={<ClockCircleOutlined style={{ color: '#722ed1' }} />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginTop: 24 }}>
        {/* 当前学习进度 */}
        <Col span={12}>
          <Card title="当前学习进度" bordered={false}>
            <div style={{ marginBottom: 16 }}>
              <Text strong>{currentNode?.title}</Text>
              <br />
              <Text type="secondary">{currentNode?.description}</Text>
            </div>
            <Progress percent={currentNode?.progress || 0} status="active" />
            <div style={{ marginTop: 16 }}>
              <Text type="secondary">学习路径：{mockLearningPath.title}</Text>
            </div>
          </Card>
        </Col>

        {/* 学习效果评估 */}
        <Col span={12}>
          <Card title="学习效果评估" bordered={false}>
            <Space direction="vertical" style={{ width: '100%' }}>
              {mockAssessments.slice(0, 3).map((item, index) => (
                <div key={index}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text>{item.dimension}</Text>
                    <Text strong>{item.score}分</Text>
                  </div>
                  <Progress percent={item.score} showInfo={false} size="small" />
                </div>
              ))}
            </Space>
          </Card>
        </Col>
      </Row>

      {/* 学习画像概览 */}
      <Row gutter={16} style={{ marginTop: 24 }}>
        <Col span={24}>
          <Card
            title="学习画像概览"
            bordered={false}
            extra={<a href="#" onClick={(e) => { e.preventDefault(); }}>查看详情</a>}
          >
            <Row gutter={16}>
              {initialProfile.dimensions.map((dim, index) => (
                <Col span={8} key={index} style={{ marginBottom: 16 }}>
                  <Card size="small" style={{ background: '#fafafa' }}>
                    <Space>
                      <Avatar size="small" style={{ background: dim.level === '高' ? '#52c41a' : dim.level === '中' ? '#1890ff' : '#faad14' }}>
                        {dim.label[0]}
                      </Avatar>
                      <div>
                        <Text strong>{dim.label}</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 12 }}>{dim.value}</Text>
                      </div>
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>

      {/* 多智能体协作展示 */}
      <Row gutter={16} style={{ marginTop: 24 }}>
        <Col span={24}>
          <Card title="多智能体协作系统" bordered={false}>
            <List
              grid={{ gutter: 16, xs: 1, sm: 2, md: 5 }}
              dataSource={agentStatusList}
              renderItem={(item) => (
                <List.Item>
                  <Card size="small" style={{ borderTop: `3px solid ${item.color}` }}>
                    <Space direction="vertical" style={{ width: '100%', textAlign: 'center' }}>
                      <Tag color={item.color}>{item.active ? '运行中' : '待激活'}</Tag>
                      <Text strong style={{ fontSize: 12 }}>{item.name}</Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>{item.desc}</Text>
                    </Space>
                  </Card>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Home;
