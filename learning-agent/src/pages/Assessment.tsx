import { useState } from 'react';
import {
  Card, Typography, Tag, Space, Row, Col, Progress,
  List, Avatar, Statistic, Timeline
} from 'antd';
import {
  DashboardOutlined,
  RiseOutlined,
  FallOutlined,
  MinusOutlined,
  TrophyOutlined,
  FireOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { mockAssessments, mockLearningPath } from '../data/mockData';

const { Title, Text } = Typography;

const Assessment: React.FC = () => {
  const [assessments] = useState(mockAssessments);

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <RiseOutlined style={{ color: '#52c41a' }} />;
      case 'down':
        return <FallOutlined style={{ color: '#f5222d' }} />;
      default:
        return <MinusOutlined style={{ color: '#d9d9d9' }} />;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up':
        return 'success';
      case 'down':
        return 'danger';
      default:
        return 'default';
    }
  };

  // 计算总体评分
  const overallScore = Math.round(assessments.reduce((sum, a) => sum + a.score, 0) / assessments.length);

  // 学习行为数据
  const learningStats = [
    { label: '本周学习时长', value: '12.5', unit: '小时', trend: 'up', trendValue: '+15%' },
    { label: '完成练习题数', value: '86', unit: '道', trend: 'up', trendValue: '+23' },
    { label: '资源浏览量', value: '45', unit: '个', trend: 'stable', trendValue: '0' },
    { label: '平均正确率', value: '78', unit: '%', trend: 'up', trendValue: '+5%' },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>学习效果评估</Title>
      <Text type="secondary">多维度精准评估学习效果，动态调整学习方案</Text>

      {/* 总体评分 */}
      <Row gutter={16} style={{ marginTop: 24 }}>
        <Col span={6}>
          <Card style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff' }}>
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>总体评分</span>}
              value={overallScore}
              suffix="分"
              valueStyle={{ color: '#fff', fontSize: 48 }}
              prefix={<TrophyOutlined />}
            />
            <div style={{ marginTop: 8, color: 'rgba(255,255,255,0.8)' }}>
              <Space>
                {getTrendIcon('up')}
                <span>较上周提升 8%</span>
              </Space>
            </div>
          </Card>
        </Col>
        {learningStats.map((stat, index) => (
          <Col span={6} key={index}>
            <Card>
              <Statistic
                title={stat.label}
                value={stat.value}
                suffix={stat.unit}
                prefix={index === 0 ? <ClockCircleOutlined /> : index === 1 ? <FireOutlined /> : <CheckCircleOutlined />}
              />
              <Tag
                icon={getTrendIcon(stat.trend)}
                color={getTrendColor(stat.trend)}
                style={{ marginTop: 8 }}
              >
                {stat.trendValue}
              </Tag>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={24} style={{ marginTop: 24 }}>
        {/* 雷达图 */}
        <Col span={12}>
          <Card title="能力雷达图">
            {/* <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 12 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} />
                <Radar
                  name="当前水平"
                  dataKey="score"
                  stroke="#8884d8"
                  fill="#8884d8"
                  fillOpacity={0.6}
                />
              </RadarChart>
            </ResponsiveContainer> */}
          </Card>
        </Col>

        {/* 评估详情 */}
        <Col span={12}>
          <Card title="多维度评估详情">
            <List
              dataSource={assessments}
              renderItem={(item, index) => (
                <List.Item>
                  <Card size="small" style={{ width: '100%', borderLeft: `3px solid ${index === 0 ? '#1890ff' : index === 1 ? '#52c41a' : index === 2 ? '#faad14' : '#722ed1'}` }}>
                    <Row gutter={16} align="middle">
                      <Col span={12}>
                        <Space>
                          <Text strong>{item.dimension}</Text>
                          <Tag icon={getTrendIcon(item.trend)} color={getTrendColor(item.trend)}>
                            {item.trend === 'up' ? '提升' : item.trend === 'down' ? '下降' : '稳定'}
                          </Tag>
                        </Space>
                        <br />
                        <Text type="secondary" style={{ fontSize: 12 }}>{item.feedback}</Text>
                      </Col>
                      <Col span={8}>
                        <Progress
                          percent={item.score}
                          size="small"
                          strokeColor={item.score >= 80 ? '#52c41a' : item.score >= 60 ? '#faad14' : '#f5222d'}
                        />
                      </Col>
                      <Col span={4} style={{ textAlign: 'right' }}>
                        <Text strong style={{ fontSize: 24 }}>{item.score}</Text>
                        <Text type="secondary">分</Text>
                      </Col>
                    </Row>
                  </Card>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      {/* 学习路径完成情况 */}
      <Card title="学习路径完成情况" style={{ marginTop: 24 }}>
        <Row gutter={16}>
          {mockLearningPath.nodes.map((node, index) => (
            <Col span={6} key={node.id}>
              <Card size="small" style={{ textAlign: 'center' }}>
                <Avatar
                  size={48}
                  style={{
                    background: node.status === 'completed' ? '#52c41a' : node.status === 'in-progress' ? '#1890ff' : '#d9d9d9',
                    marginBottom: 8,
                  }}
                >
                  {index + 1}
                </Avatar>
                <br />
                <Text strong style={{ fontSize: 12 }}>{node.title}</Text>
                <br />
                <Progress
                  percent={node.progress}
                  size="small"
                  strokeColor={node.status === 'completed' ? '#52c41a' : '#1890ff'}
                  style={{ marginTop: 8 }}
                />
                <Tag
                  color={node.status === 'completed' ? 'success' : node.status === 'in-progress' ? 'processing' : 'default'}
                  style={{ marginTop: 4 }}
                >
                  {node.status === 'completed' ? '已完成' : node.status === 'in-progress' ? '进行中' : '未开始'}
                </Tag>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      {/* 智能调整建议 */}
      <Card title="智能调整建议" style={{ marginTop: 24 }}>
        <Timeline
          items={[
            {
              color: 'blue',
              dot: <DashboardOutlined />,
              children: (
                <Space direction="vertical">
                  <Text strong>优化学习资源推送策略</Text>
                  <Text type="secondary">根据您最近的练习数据，系统将增加"算法设计"类题目的推送比例</Text>
                </Space>
              ),
            },
            {
              color: 'green',
              dot: <CheckCircleOutlined />,
              children: (
                <Space direction="vertical">
                  <Text strong>学习计划调整</Text>
                  <Text type="secondary">建议将"深度学习入门"模块的学习时间延长2天，加强基础理解</Text>
                </Space>
              ),
            },
            {
              color: 'orange',
              dot: <FireOutlined />,
              children: (
                <Space direction="vertical">
                  <Text strong>薄弱点突破</Text>
                  <Text type="secondary">检测到您在"多线程并发编程"方面存在较大困难，已为您生成专项练习资源</Text>
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default Assessment;
