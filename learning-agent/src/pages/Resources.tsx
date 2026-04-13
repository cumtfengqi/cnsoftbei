import React, { useState } from 'react';
import { Card, Typography, Tag, Space, Button, Row, Col, List, Avatar, Spin, Progress, Modal, Form, Input, Select, Checkbox, message } from 'antd';
import {
  FileTextOutlined,
  AimOutlined,
  ReadOutlined,
  PlayCircleOutlined,
  CodeOutlined,
  ThunderboltOutlined,
  RobotOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { mockResources, agents } from '../data/mockData';
import type { ResourceType, LearningResource } from '../types';

const { Title, Text } = Typography;

const Resources: React.FC = () => {
  const [generating, setGenerating] = useState(false);
  const [generatingType, setGeneratingType] = useState<ResourceType | null>(null);
  const [progress, setProgress] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<ResourceType[]>([]);
  const [learningNeed, setLearningNeed] = useState('');

  const [form] = Form.useForm();

  const resourceTypeConfig: Record<ResourceType, { icon: React.ReactNode; color: string; label: string }> = {
    document: { icon: <FileTextOutlined />, color: '#1890ff', label: '课程文档' },
    mindmap: { icon: <AimOutlined />, color: '#52c41a', label: '思维导图' },
    quiz: { icon: <ThunderboltOutlined />, color: '#faad14', label: '练习题库' },
    reading: { icon: <ReadOutlined />, color: '#722ed1', label: '拓展阅读' },
    video: { icon: <PlayCircleOutlined />, color: '#eb2f96', label: '教学视频' },
    codeCase: { icon: <CodeOutlined />, color: '#13c2c2', label: '代码案例' },
  };

  const handleGenerate = () => {
    if (selectedTypes.length === 0) {
      message.warning('请至少选择一种资源类型');
      return;
    }

    setIsModalOpen(true);
  };

  const startGeneration = () => {
    setIsModalOpen(false);
    setGenerating(true);
    setProgress(0);

    // 模拟生成进度
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setGenerating(false);
          setGeneratingType(null);
          message.success('资源生成完成！');
          return 100;
        }
        return prev + Math.random() * 15;
      });
    }, 500);
  };

  const renderResourceCard = (resource: LearningResource) => {
    const config = resourceTypeConfig[resource.type];
    return (
      <Card
        hoverable
        style={{ borderTop: `3px solid ${config.color}` }}
        actions={[
          <Button type="link" key="view">查看</Button>,
          <Button type="link" key="download">下载</Button>,
        ]}
      >
        <Card.Meta
          avatar={<Avatar icon={config.icon} style={{ background: config.color }} />}
          title={resource.title}
          description={
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>{resource.description}</Text>
              <Space>
                <Tag icon={config.icon} color={config.color}>{config.label}</Tag>
                <Tag icon={<RobotOutlined />}>AI生成</Tag>
              </Space>
              <Text type="secondary" style={{ fontSize: 11 }}>
                生成者：{resource.generatedBy}
              </Text>
            </Space>
          }
        />
      </Card>
    );
  };

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>多智能体资源生成</Title>
      <Text type="secondary">通过不同角色的智能体协作，生成个性化多模态学习资源</Text>

      {/* 智能体协作流程 */}
      <Card title="多智能体协作流程" style={{ marginTop: 24 }}>
        <Row gutter={16} align="middle">
          {[
            { name: '画像构建', desc: '分析学习需求', color: '#1890ff', icon: <RobotOutlined /> },
            { name: '资源规划', desc: '制定生成方案', color: '#52c41a', icon: <RobotOutlined /> },
            { name: '内容生成', desc: '多模态产出', color: '#faad14', icon: <RobotOutlined /> },
            { name: '质量审核', desc: '校验与优化', color: '#722ed1', icon: <RobotOutlined /> },
          ].map((agent, index) => (
            <React.Fragment key={index}>
              <Col span={5} style={{ textAlign: 'center' }}>
                <Avatar size={64} style={{ background: agent.color }} icon={agent.icon} />
                <div style={{ marginTop: 8 }}>
                  <Text strong>{agent.name}</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>{agent.desc}</Text>
                </div>
              </Col>
              {index < 3 && (
                <Col span={1} style={{ textAlign: 'center' }}>
                  <Text type="secondary">→</Text>
                </Col>
              )}
            </React.Fragment>
          ))}
        </Row>
      </Card>

      {/* 资源生成控制台 */}
      <Card
        title="资源生成控制台"
        extra={
          <Button type="primary" icon={<ThunderboltOutlined />} onClick={handleGenerate}>
            生成资源
          </Button>
        }
        style={{ marginTop: 24 }}
      >
        {generating ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>
              <Text>正在生成{generatingType ? resourceTypeConfig[generatingType].label : '资源'}...</Text>
            </div>
            <Progress percent={Math.round(progress)} status="active" style={{ marginTop: 16, maxWidth: 400, margin: '16px auto' }} />
            <Text type="secondary">多智能体协同工作中，请稍候</Text>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 40, background: '#fafafa', borderRadius: 8 }}>
            <ThunderboltOutlined style={{ fontSize: 48, color: '#faad14' }} />
            <div style={{ marginTop: 16 }}>
              <Text strong style={{ fontSize: 16 }}>点击"生成资源"开始多智能体协作</Text>
              <br />
              <Text type="secondary">系统将根据您的学习画像和需求，生成5种以上个性化学习资源</Text>
            </div>
          </div>
        )}
      </Card>

      {/* 已生成资源展示 */}
      <Card title="已生成资源" style={{ marginTop: 24 }}>
        <List
          grid={{ gutter: 16, xs: 1, sm: 2, md: 3 }}
          dataSource={mockResources}
          renderItem={renderResourceCard}
          locale={{ emptyText: '暂无生成资源，请点击上方按钮生成' }}
        />
      </Card>

      {/* 资源类型说明 */}
      <Card title="支持生成的资源类型" style={{ marginTop: 24 }}>
        <Row gutter={16}>
          {Object.entries(resourceTypeConfig).map(([key, config]) => (
            <Col span={8} key={key} style={{ marginBottom: 16 }}>
              <Card size="small" style={{ background: `${config.color}10`, border: `1px solid ${config.color}` }}>
                <Space>
                  <Avatar icon={config.icon} style={{ background: config.color }} />
                  <div>
                    <Text strong>{config.label}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {key === 'document' && '专业课程讲解文档、知识点解析'}
                      {key === 'mindmap' && '知识点思维导图、知识体系梳理'}
                      {key === 'quiz' && '选择题、填空题、编程题'}
                      {key === 'reading' && '论文导读、拓展材料'}
                      {key === 'video' && '教学动画、算法演示'}
                      {key === 'codeCase' && '实战项目、代码案例'}
                    </Text>
                  </div>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      {/* 生成配置弹窗 */}
      <Modal
        title="配置资源生成"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={startGeneration}
        okText="开始生成"
      >
        <Form form={form} layout="vertical">
          <Form.Item label="学习需求描述">
            <Input.TextArea
              rows={3}
              placeholder="描述你需要的学习资源，如：Python面向对象编程、机器学习算法等"
              value={learningNeed}
              onChange={e => setLearningNeed(e.target.value)}
            />
          </Form.Item>
          <Form.Item label="选择要生成的资源类型（至少5种）">
            <Checkbox.Group
              value={selectedTypes}
              onChange={(values) => setSelectedTypes(values as ResourceType[])}
              style={{ width: '100%' }}
            >
              <Row gutter={[16, 8]}>
                {Object.entries(resourceTypeConfig).map(([key, config]) => (
                  <Col span={12} key={key}>
                    <Checkbox value={key}>
                      <Space>
                        {config.icon}
                        <span>{config.label}</span>
                        {selectedTypes.includes(key as ResourceType) && (
                          <CheckCircleOutlined style={{ color: '#52c41a' }} />
                        )}
                      </Space>
                    </Checkbox>
                  </Col>
                ))}
              </Row>
            </Checkbox.Group>
          </Form.Item>
          <Text type="secondary">
            已选择 {selectedTypes.length} 种资源类型，系统将通过多智能体协作完成生成
          </Text>
        </Form>
      </Modal>
    </div>
  );
};

export default Resources;
