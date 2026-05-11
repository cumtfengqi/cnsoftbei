import { useState, useRef, useEffect } from 'react';
import { Card, Typography, Tag, Space, Button, Row, Col, Steps, Progress, List, Avatar, Collapse, message } from 'antd';
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  PlayCircleOutlined,
  BulbOutlined,
  RobotOutlined,
  AimOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { mockLearningPath, mockResources, smartRecommendations } from '../data/mockData';
import { streamChatCompletion } from '../services/api';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { usePageCache } from '../context/PageCacheContext';
import type { LearningPath } from '../types';

const { Title, Text } = Typography;
const { Panel } = Collapse;

const PAGE_KEY = 'path';

interface LearningNode {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed';
  progress: number;
  estimatedHours?: number;
}

const Path: React.FC = () => {
  const { cachedState, saveState } = usePageCache(PAGE_KEY);

  const [pathData, setPathData] = useState<LearningPath>(() => cachedState?.pathData ?? mockLearningPath);
  const [activeNode, setActiveNode] = useState<string>(() => cachedState?.activeNode ?? mockLearningPath.currentNodeId);
  const [isPlanning, setIsPlanning] = useState<boolean>(() => cachedState?.isPlanning ?? false);
  const [planningResult, setPlanningResult] = useState<string | null>(() => cachedState?.planningResult ?? null);
  const [currentPlanText, setCurrentPlanText] = useState<string>(() => cachedState?.currentPlanText ?? '');

  const inputRef = useRef<HTMLInputElement>(null);

  // 缓存状态变化
  useEffect(() => {
    saveState({ pathData, activeNode, isPlanning, planningResult, currentPlanText });
  }, [pathData, activeNode, isPlanning, planningResult, currentPlanText, saveState]);

  // 调用AI生成个性化学习路径（流式）
  const generateLearningPath = async (topic: string) => {
    setIsPlanning(true);
    setCurrentPlanText('');
    try {
      const messages = [
        { role: 'system' as const, content: `你是路径规划智能体，专门为学生制定个性化的学习路径。

请根据用户输入的学习主题或专业方向，生成一个详细的学习路径规划。

要求：
1. 按照知识点的依赖关系排序（前置知识必须先学）
2. 每个阶段有明确的目标和内容
3. 包含预估学习时间
4. 用清晰的层级结构展示

请用以下JSON格式输出（只输出JSON，不要其他内容）：
{
  "title": "学习路径名称",
  "description": "路径描述",
  "nodes": [
    {
      "title": "阶段1名称",
      "description": "阶段描述",
      "estimatedHours": 8,
      "resources": ["相关资源描述1", "资源2"]
    },
    ...
  ]
}` },
        { role: 'user' as const, content: `请为"${topic}"生成一个完整的个性化学习路径规划` },
      ];

      let fullResponse = '';
      let hasJsonParsed = false;

      await streamChatCompletion(
        messages,
        (chunk, isThinking) => {
          if (!isThinking) {
            fullResponse += chunk;
            // 如果还没解析JSON，继续累积
            if (!hasJsonParsed) {
              setCurrentPlanText(prev => prev + chunk);
            }
          }
        },
        () => {
          // 思考过程处理
        }
      );

      // 尝试解析JSON
      try {
        let jsonStr = fullResponse;
        const jsonMatch = fullResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || fullResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonStr = jsonMatch[1] || jsonMatch[0];
        }

        const planData = JSON.parse(jsonStr.includes('{') ? jsonStr.substring(jsonStr.indexOf('{')).replace(/```/g, '') : jsonStr);
        hasJsonParsed = true;

        const newNodes: LearningNode[] = planData.nodes.map((node: any, index: number) => ({
          id: `node-${index + 1}`,
          title: node.title,
          description: node.description,
          status: index === 0 ? 'in-progress' : 'pending',
          progress: index === 0 ? 0 : 0,
          estimatedHours: node.estimatedHours || 8,
        }));

        setPathData({
          id: 'path-ai',
          title: planData.title || `${topic}学习路径`,
          description: planData.description || 'AI生成的个性化学习路径',
          nodes: newNodes,
          estimatedTime: `${Math.round(newNodes.reduce((sum: number, n: LearningNode) => sum + (n.estimatedHours || 8), 0) / 40)}周`,
          currentNodeId: newNodes[0]?.id || 'node-1',
        });

        setActiveNode(newNodes[0]?.id || 'node-1');
        setPlanningResult('学习路径规划完成！');
        message.success('AI已为您生成个性化学习路径');

      } catch (parseError) {
        console.error('Failed to parse path planning result:', parseError);
        setPlanningResult('路径解析异常，请查看生成内容');
      }

    } catch (error: any) {
      console.error('Path planning failed:', error);
      message.error('路径规划失败：' + error.message);
    } finally {
      setIsPlanning(false);
    }
  };

  const handleGenerate = () => {
    const value = inputRef.current?.value || '';
    if (value.trim()) {
      generateLearningPath(value);
    }
  };

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

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>个性化学习路径</Title>
      <Text type="secondary">基于您的学习画像和目标，智能规划学习步骤与顺序</Text>

      {/* AI路径规划入口 */}
      <Card style={{ marginTop: 24 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space>
            <Avatar icon={<AimOutlined />} style={{ background: '#faad14' }} />
            <div>
              <Text strong>AI智能路径规划</Text>
              <br />
              <Text type="secondary">基于您的学习画像，自动生成最优学习路径</Text>
            </div>
          </Space>
          <Space.Compact style={{ width: '100%' }}>
            <input
              ref={inputRef}
              type="text"
              placeholder="输入您想学习的主题，如：Python面向对象编程、机器学习..."
              style={{
                flex: 1,
                padding: '8px 12px',
                border: '1px solid #d9d9d9',
                borderRadius: '6px',
                outline: 'none',
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isPlanning) {
                  handleGenerate();
                }
              }}
              disabled={isPlanning}
            />
            <Button
              type="primary"
              icon={isPlanning ? <LoadingOutlined /> : <RobotOutlined />}
              onClick={handleGenerate}
              loading={isPlanning}
            >
              {isPlanning ? '生成中' : '生成路径'}
            </Button>
          </Space.Compact>

          {/* 流式显示规划内容 */}
          {isPlanning && currentPlanText && (
            <Card size="small" style={{ background: '#f5f5f5', marginTop: 8 }}>
              <Text type="secondary">正在规划：</Text>
              <div style={{
                maxHeight: 200,
                overflow: 'auto',
                fontSize: 12,
                marginTop: 8,
              }}>
                <MarkdownRenderer content={currentPlanText} />
                <span style={{ animation: 'blink 1s infinite' }}>|</span>
              </div>
            </Card>
          )}

          {planningResult && (
            <Tag color="success" icon={<CheckCircleOutlined />}>{planningResult}</Tag>
          )}
        </Space>
      </Card>

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
                  {node.estimatedHours && (
                    <div style={{ marginTop: 8 }}>
                      <Tag icon={<ClockCircleOutlined />}>预估时长：{node.estimatedHours}小时</Tag>
                    </div>
                  )}
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
              dataSource={smartRecommendations}
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
                  description={<Tag color="blue">精准推送</Tag>}
                />
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      {/* 添加闪烁动画样式 */}
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default Path;