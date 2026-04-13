import React, { useState } from 'react';
import { Card, Typography, Tag, Space, Button, Row, Col, Avatar, Spin, Progress, Modal, Form, Input, Checkbox, message, Alert } from 'antd';
import {
  FileTextOutlined,
  AimOutlined,
  ReadOutlined,
  PlayCircleOutlined,
  CodeOutlined,
  ThunderboltOutlined,
  RobotOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { multiAgentScheduler, resourceGenerator, type AgentRole } from '../services/multiAgentFramework';
import type { ResourceType } from '../types';

const { Title, Text } = Typography;
const { TextArea } = Input;

// 资源类型配置
const resourceTypeConfig: Record<ResourceType, { icon: React.ReactNode; color: string; label: string; desc: string }> = {
  document: { icon: <FileTextOutlined />, color: '#1890ff', label: '课程文档', desc: '专业课程讲解文档、知识点解析' },
  mindmap: { icon: <AimOutlined />, color: '#52c41a', label: '思维导图', desc: '知识点思维导图、知识体系梳理' },
  quiz: { icon: <ThunderboltOutlined />, color: '#faad14', label: '练习题库', desc: '选择题、填空题、编程题' },
  reading: { icon: <ReadOutlined />, color: '#722ed1', label: '拓展阅读', desc: '论文导读、拓展材料' },
  video: { icon: <PlayCircleOutlined />, color: '#eb2f96', label: '教学视频', desc: '教学动画、算法演示' },
  codeCase: { icon: <CodeOutlined />, color: '#13c2c2', label: '代码案例', desc: '实战项目、代码案例' },
};

const Resources: React.FC = () => {
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<Record<ResourceType, number>>({} as Record<ResourceType, number>);
  const [currentStep, setCurrentStep] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<ResourceType[]>([]);
  const [learningNeed, setLearningNeed] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [displayedResources, setDisplayedResources] = useState<{ type: ResourceType; content: string }[]>([]);

  const [form] = Form.useForm();

  // 获取智能体状态
  const getAgentStatus = (role: AgentRole) => {
    const agent = multiAgentScheduler.getAgent(role);
    return agent?.status || 'idle';
  };

  // 获取智能体状态颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'thinking': return '#1890ff';
      case 'speaking': return '#52c41a';
      case 'completed': return '#52c41a';
      case 'error': return '#f5222d';
      default: return '#d9d9d9';
    }
  };

  // 获取智能体状态图标
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'thinking': return <LoadingOutlined />;
      case 'speaking': return <RobotOutlined />;
      case 'completed': return <CheckCircleOutlined />;
      default: return <RobotOutlined />;
    }
  };

  // 打开配置弹窗
  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  // 关闭配置弹窗
  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  // 开始生成资源
  const startGeneration = async () => {
    // 验证
    if (selectedTypes.length === 0) {
      message.warning('请至少选择一种资源类型');
      return;
    }
    if (!learningNeed.trim()) {
      message.warning('请输入学习需求描述');
      return;
    }

    setIsModalOpen(false);
    setGenerating(true);
    setProgress({} as Record<ResourceType, number>);
    setError(null);
    setDisplayedResources([]);

    try {
      setCurrentStep('初始化多智能体协同框架...');
      await new Promise(resolve => setTimeout(resolve, 800));

      // 调用资源生成服务
      const results = await resourceGenerator.generateResources(
        selectedTypes,
        learningNeed,
        (type, step, p) => {
          setProgress(prev => ({ ...prev, [type]: p }));
          setCurrentStep(`${resourceTypeConfig[type].label} - ${step}`);
        }
      );

      // 将结果转换为数组用于展示
      const resourcesArray = Object.entries(results).map(([type, content]) => ({
        type: type as ResourceType,
        content,
      }));
      setDisplayedResources(resourcesArray);

      message.success('资源生成完成！');
    } catch (err: any) {
      console.error('Generation failed:', err);
      setError(err.message || '资源生成失败，请重试');
      message.error('资源生成失败');
    } finally {
      setGenerating(false);
    }
  };

  // 渲染生成的资源内容
  const renderResourceContent = (type: ResourceType, content: string) => {
    if (type === 'mindmap') {
      return (
        <pre style={{
          background: '#f5f5f5',
          padding: 16,
          borderRadius: 8,
          overflow: 'auto',
          maxHeight: 400,
          fontSize: 12,
          whiteSpace: 'pre-wrap',
        }}>
          {content}
        </pre>
      );
    }

    if (type === 'quiz') {
      return (
        <div style={{
          background: '#f5f5f5',
          padding: 16,
          borderRadius: 8,
          maxHeight: 400,
          overflow: 'auto',
        }}>
          {content.split('\n').map((line, i) => (
            <div key={i} style={{ marginBottom: 8 }}>{line}</div>
          ))}
        </div>
      );
    }

    if (type === 'codeCase') {
      return (
        <pre style={{
          background: '#1e1e1e',
          color: '#d4d4d4',
          padding: 16,
          borderRadius: 8,
          overflow: 'auto',
          maxHeight: 400,
          fontSize: 12,
          whiteSpace: 'pre-wrap',
        }}>
          {content}
        </pre>
      );
    }

    return (
      <div style={{
        background: '#fafafa',
        padding: 16,
        borderRadius: 8,
        maxHeight: 400,
        overflow: 'auto',
        whiteSpace: 'pre-wrap',
      }}>
        {content}
      </div>
    );
  };

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>多智能体资源生成</Title>
      <Text type="secondary">通过不同角色的智能体协作，基于大模型生成个性化多模态学习资源</Text>

      {/* 错误提示 */}
      {error && (
        <Alert
          message="生成出错"
          description={error}
          type="error"
          closable
          onClose={() => setError(null)}
          style={{ marginTop: 16 }}
        />
      )}

      {/* 多智能体协作状态 */}
      <Card title="多智能体协作状态" style={{ marginTop: 24 }}>
        <Row gutter={16} align="middle">
          {[
            { name: '画像构建', desc: '分析学习需求', role: 'profile' as AgentRole },
            { name: '资源规划', desc: '制定生成方案', role: 'resource' as AgentRole },
            { name: '内容生成', desc: '多模态产出', role: 'resource' as AgentRole },
            { name: '质量审核', desc: '校验与优化', role: 'assessment' as AgentRole },
          ].map((agent, index) => {
            const status = getAgentStatus(agent.role);
            return (
              <React.Fragment key={agent.name}>
                <Col span={5} style={{ textAlign: 'center' }}>
                  <Avatar
                    size={64}
                    style={{ background: getStatusColor(status) }}
                    icon={getStatusIcon(status)}
                  />
                  <div style={{ marginTop: 8 }}>
                    <Text strong>{agent.name}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>{agent.desc}</Text>
                  </div>
                  <Tag
                    color={status === 'completed' ? 'success' : status === 'thinking' ? 'processing' : 'default'}
                    style={{ marginTop: 4 }}
                  >
                    {status === 'idle' ? '待命' :
                     status === 'thinking' ? '思考中' :
                     status === 'speaking' ? '生成中' :
                     status === 'completed' ? '完成' : '错误'}
                  </Tag>
                </Col>
                {index < 3 && (
                  <Col span={1} style={{ textAlign: 'center' }}>
                    <Text type="secondary">→</Text>
                  </Col>
                )}
              </React.Fragment>
            );
          })}
        </Row>
      </Card>

      {/* 资源生成控制台 */}
      <Card
        title={
          <Space>
            <RobotOutlined />
            <span>资源生成控制台</span>
          </Space>
        }
        extra={
          !generating && (
            <Button type="primary" icon={<ThunderboltOutlined />} onClick={handleOpenModal}>
              生成资源
            </Button>
          )
        }
        style={{ marginTop: 24 }}
      >
        {generating ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />} />
            <div style={{ marginTop: 24 }}>
              <Text strong style={{ fontSize: 16 }}>多智能体协同生成中...</Text>
              <br />
              <Text type="secondary">{currentStep}</Text>
            </div>

            {/* 各类型生成进度 */}
            <div style={{ marginTop: 32, maxWidth: 600, margin: '32px auto 0' }}>
              {selectedTypes.map(type => (
                <div key={type} style={{ marginBottom: 16 }}>
                  <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                    <Space>
                      {resourceTypeConfig[type].icon}
                      <Text>{resourceTypeConfig[type].label}</Text>
                      {progress[type] === 100 ? (
                        <CheckCircleOutlined style={{ color: '#52c41a' }} />
                      ) : (
                        <LoadingOutlined />
                      )}
                    </Space>
                    <Text>{Math.round(progress[type] || 0)}%</Text>
                  </Space>
                  <Progress
                    percent={Math.round(progress[type] || 0)}
                    status={progress[type] === 100 ? 'success' : 'active'}
                    size="small"
                    strokeColor={resourceTypeConfig[type].color}
                    style={{ marginTop: 4 }}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 40, background: '#fafafa', borderRadius: 8 }}>
            <RobotOutlined style={{ fontSize: 48, color: '#1890ff' }} />
            <div style={{ marginTop: 16 }}>
              <Text strong style={{ fontSize: 16 }}>点击"生成资源"启动多智能体协作</Text>
              <br />
              <Text type="secondary">系统将调用大模型，为您生成多种个性化学习资源</Text>
            </div>
          </div>
        )}
      </Card>

      {/* 已生成资源展示 */}
      {displayedResources.length > 0 && (
        <Card title="已生成资源" style={{ marginTop: 24 }}>
          <Row gutter={[16, 16]}>
            {displayedResources.map((item) => (
              <Col span={12} key={item.type}>
                <Card
                  size="small"
                  style={{ borderTop: `3px solid ${resourceTypeConfig[item.type].color}` }}
                  title={
                    <Space>
                      {resourceTypeConfig[item.type].icon}
                      <span>{resourceTypeConfig[item.type].label}</span>
                      <Tag color="success">AI生成</Tag>
                    </Space>
                  }
                  extra={<Tag icon={<RobotOutlined />}>资源生成智能体</Tag>}
                >
                  {renderResourceContent(item.type, item.content)}
                </Card>
              </Col>
            ))}
          </Row>
        </Card>
      )}

      {/* 资源类型说明 */}
      <Card title="支持生成的资源类型" style={{ marginTop: 24 }}>
        <Row gutter={16}>
          {Object.entries(resourceTypeConfig).map(([key, config]) => (
            <Col span={8} key={key} style={{ marginBottom: 16 }}>
              <Card
                size="small"
                style={{
                  background: `${config.color}10`,
                  border: `1px solid ${config.color}`,
                  opacity: selectedTypes.includes(key as ResourceType) ? 1 : 0.7,
                }}
              >
                <Space>
                  <Avatar icon={config.icon} style={{ background: config.color }} />
                  <div>
                    <Text strong>{config.label}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {config.desc}
                    </Text>
                  </div>
                  {selectedTypes.includes(key as ResourceType) && (
                    <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  )}
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
        onCancel={handleCloseModal}
        onOk={startGeneration}
        okText="开始生成"
        width={600}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item label="学习需求描述">
            <TextArea
              rows={4}
              placeholder="描述你需要的学习资源，例如：Python面向对象编程、机器学习算法、深度学习基础等"
              value={learningNeed}
              onChange={e => setLearningNeed(e.target.value)}
            />
          </Form.Item>
          <Form.Item
            label="选择要生成的资源类型"
            extra={<Text type="secondary">选择越多，生成时间越长，请耐心等待</Text>}
          >
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
                      </Space>
                    </Checkbox>
                  </Col>
                ))}
              </Row>
            </Checkbox.Group>
          </Form.Item>
          <div style={{ background: '#e6f7ff', padding: 12, borderRadius: 8, marginTop: 16 }}>
            <Text type="secondary">
              已选择 <Text strong>{selectedTypes.length}</Text> 种资源类型，
              学习主题：<Text strong>{learningNeed || '未指定'}</Text>
            </Text>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default Resources;
