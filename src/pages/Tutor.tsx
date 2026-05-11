import { useState, useRef, useEffect } from 'react';
import { Card, Typography, Tag, Space, Button, Row, Col, List, Avatar, Input, Badge, Tabs, message, Spin } from 'antd';
import {
  RobotOutlined,
  FileTextOutlined,
  PictureOutlined,
  VideoCameraOutlined,
  CodeOutlined,
  SendOutlined,
  LikeOutlined,
  DislikeOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { streamChatCompletion } from '../services/api';
import type { QAItem } from '../types';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { usePageCache } from '../context/PageCacheContext';

const { Title, Text } = Typography;
const { TextArea } = Input;

const PAGE_KEY = 'tutor';

const defaultHistory: QAItem[] = [
  {
    id: '1',
    question: '什么是反向传播算法？',
    answer: '反向传播（Backpropagation）是神经网络中用于训练的核心算法。它通过计算损失函数对每个权重的梯度，从输出层向输入层反向传播误差，从而更新网络参数使损失最小化。简单来说，就是"从错误中学习"的过程。',
    type: 'text',
    helpful: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    question: 'Python装饰器如何使用？',
    answer: '装饰器是Python中强大的语法糖，用于修改函数或类的行为。基本用法：在函数上方使用@decorator_name即可。常用场景包括：日志记录、权限验证、缓存等。\n\n```python\ndef my_decorator(func):\n    def wrapper(*args, **kwargs):\n        print("执行前")\n        result = func(*args, **kwargs)\n        print("执行后")\n        return result\n    return wrapper\n\n@my_decorator\ndef say_hello():\n    print("Hello!")\n```',
    type: 'code',
    helpful: true,
    createdAt: new Date().toISOString(),
  },
];

const Tutor: React.FC = () => {
  const { cachedState, saveState } = usePageCache(PAGE_KEY);

  const [question, setQuestion] = useState(() => cachedState?.question ?? '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentAnswer, setCurrentAnswer] = useState(() => cachedState?.currentAnswer ?? '');
  const [activeMode, setActiveMode] = useState(() => cachedState?.activeMode ?? 'text');
  const [history, setHistory] = useState<QAItem[]>(() => cachedState?.history ?? defaultHistory);

  const answerRef = useRef<HTMLDivElement>(null);

  // 缓存状态变化
  useEffect(() => {
    saveState({ question, currentAnswer, activeMode, history });
  }, [question, currentAnswer, activeMode, history, saveState]);

  useEffect(() => {
    if (currentAnswer && answerRef.current) {
      answerRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentAnswer]);

  const handleAsk = async () => {
    if (!question.trim()) return;
    if (isGenerating) return;

    const userQuestion = question;
    setQuestion('');
    setIsGenerating(true);
    setCurrentAnswer('');

    try {
      // 根据选择的模式构建系统提示
      const modePrompts: Record<string, string> = {
        text: '你是一位专业的AI辅导老师，请详细解答用户的问题。用清晰的结构回答，包含必要的解释和示例。',
        image: '你是一位专业的AI辅导老师，请解答用户的问题并生成可视化图解说明。尽量用ASCII图或结构化方式来展示概念。',
        video: '你是一位专业的AI辅导老师，请为用户提供视频讲解脚本。内容包括开场、讲解步骤、总结，每部分时间控制在1分钟内。',
        code: '你是一位专业的编程老师，请为用户提供完整的代码示例。代码要包含注释和运行说明。',
      };

      const messages = [
        { role: 'system' as const, content: modePrompts[activeMode] || modePrompts.text },
        { role: 'user' as const, content: userQuestion },
      ];

      let fullAnswer = '';

      await streamChatCompletion(
        messages,
        (chunk, isThinking) => {
          if (!isThinking) {
            fullAnswer += chunk;
            setCurrentAnswer(fullAnswer);
          }
        },
        () => {}
      );

      // 保存到历史
      const newQA: QAItem = {
        id: `qa-${Date.now()}`,
        question: userQuestion,
        answer: fullAnswer,
        type: activeMode as 'text' | 'image' | 'video' | 'code',
        helpful: false,
        createdAt: new Date().toISOString(),
      };

      setHistory(prev => [newQA, ...prev]);
      message.success('解答完成！');

    } catch (error: any) {
      console.error('Tutor failed:', error);
      message.error('解答失败：' + error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFeedback = (id: string, helpful: boolean) => {
    setHistory(prev => prev.map(item =>
      item.id === id ? { ...item, helpful } : item
    ));
    message.success(helpful ? '感谢您的肯定！' : '感谢反馈，我们会继续改进');
  };

  const handleQuickQuestion = (q: string) => {
    setQuestion(q);
  };

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>智能辅导</Title>
      <Text type="secondary">即时答疑，提供多模态解答服务（文字、图解、视频、代码）</Text>

      {/* 解答模式切换 */}
      <Card style={{ marginTop: 24 }}>
        <Tabs
          activeKey={activeMode}
          onChange={setActiveMode}
          items={[
            {
              key: 'text',
              label: <span><FileTextOutlined /> 文字解答</span>,
              children: (
                <div style={{ padding: 16, background: '#fafafa', borderRadius: 8 }}>
                  <Text type="secondary">提供详细的文字解释和分析步骤</Text>
                </div>
              ),
            },
            {
              key: 'image',
              label: <span><PictureOutlined /> 图解说明</span>,
              children: (
                <div style={{ padding: 16, background: '#fafafa', borderRadius: 8 }}>
                  <Text type="secondary">提供可视化图解，帮助理解复杂概念</Text>
                </div>
              ),
            },
            {
              key: 'video',
              label: <span><VideoCameraOutlined /> 视频讲解</span>,
              children: (
                <div style={{ padding: 16, background: '#fafafa', borderRadius: 8 }}>
                  <Text type="secondary">提供短视频讲解，step by step演示</Text>
                </div>
              ),
            },
            {
              key: 'code',
              label: <span><CodeOutlined /> 代码示例</span>,
              children: (
                <div style={{ padding: 16, background: '#fafafa', borderRadius: 8 }}>
                  <Text type="secondary">提供完整的代码示例和运行结果</Text>
                </div>
              ),
            },
          ]}
        />
      </Card>

      <Row gutter={24} style={{ marginTop: 24 }}>
        {/* 提问区域 */}
        <Col span={16}>
          <Card
            title={
              <Space>
                <Avatar style={{ background: '#722ed1' }} icon={<RobotOutlined />} />
                <span>智能辅导智能体</span>
                {isGenerating ? (
                  <Tag color="processing" icon={<LoadingOutlined />}>生成中</Tag>
                ) : (
                  <Badge status="processing" text="运行中" />
                )}
              </Space>
            }
          >
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <TextArea
                rows={4}
                placeholder="输入你的问题，例如：什么是卷积神经网络？如何实现快速排序算法？..."
                value={question}
                onChange={e => setQuestion(e.target.value)}
                onPressEnter={(e) => {
                  if (!e.shiftKey) {
                    e.preventDefault();
                    handleAsk();
                  }
                }}
                disabled={isGenerating}
              />
              <Button
                type="primary"
                icon={isGenerating ? <LoadingOutlined /> : <SendOutlined />}
                onClick={handleAsk}
                loading={isGenerating}
                block
                size="large"
              >
                {isGenerating ? '正在生成...' : '提交问题'}
              </Button>
            </Space>

            {/* 实时显示生成的答案 */}
            {currentAnswer && (
              <div style={{ marginTop: 24, padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
                <Space style={{ marginBottom: 8 }}>
                  <Tag color="purple">{activeMode === 'text' ? '文字解答' : activeMode === 'image' ? '图解说明' : activeMode === 'video' ? '视频讲解' : '代码示例'}</Tag>
                  {isGenerating && <Tag color="processing" icon={<LoadingOutlined />}>生成中</Tag>}
                </Space>
                <div
                  ref={answerRef as any}
                  style={{
                    maxHeight: 400,
                    overflow: 'auto',
                    padding: 16,
                    borderRadius: 8,
                    background: '#fff',
                  }}
                >
                  <MarkdownRenderer content={currentAnswer} />
                  {isGenerating && <span style={{ animation: 'blink 1s infinite', marginLeft: 4 }}>|</span>}
                </div>
              </div>
            )}

            {isGenerating && !currentAnswer && (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Spin size="large" />
                <div style={{ marginTop: 16 }}>
                  <Text>智能辅导智能体正在分析您的问题...</Text>
                  <br />
                  <Text type="secondary">结合知识库和上下文，为您生成多模态解答</Text>
                </div>
              </div>
            )}
          </Card>
        </Col>

        {/* 右侧：历史记录和快捷问题 */}
        <Col span={8}>
          <Card title="常见快捷问题" extra={<Tag color="purple">推荐</Tag>}>
            <List
              size="small"
              dataSource={[
                'Python面向对象三大特性',
                '机器学习常用损失函数',
                '深度学习优化器对比',
                'Git常用命令速查',
                '数据结构时间复杂度',
              ]}
              renderItem={item => (
                <List.Item>
                  <Button
                    type="link"
                    size="small"
                    onClick={() => handleQuickQuestion(item)}
                    disabled={isGenerating}
                  >
                    {item}
                  </Button>
                </List.Item>
              )}
            />
          </Card>

          <Card title="历史提问" style={{ marginTop: 16 }}>
            <List
              size="small"
              dataSource={history.slice(0, 5)}
              renderItem={item => (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <Space>
                        {item.type === 'code' ? <CodeOutlined /> : <FileTextOutlined />}
                        <Text ellipsis style={{ maxWidth: 150 }}>{item.question}</Text>
                      </Space>
                    }
                    description={
                      <Space>
                        <Tag color={item.helpful ? 'success' : 'default'}>
                          {item.helpful ? '有帮助' : '待评价'}
                        </Tag>
                        <Button
                          type="text"
                          size="small"
                          icon={<LikeOutlined />}
                          onClick={() => handleFeedback(item.id, true)}
                        />
                        <Button
                          type="text"
                          size="small"
                          icon={<DislikeOutlined />}
                          onClick={() => handleFeedback(item.id, false)}
                        />
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default Tutor;