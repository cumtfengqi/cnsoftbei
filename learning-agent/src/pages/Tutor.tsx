import React, { useState } from 'react';
import { Card, Typography, Tag, Space, Button, Row, Col, List, Avatar, Input, Badge, Tabs, Modal, message } from 'antd';
import {
  QuestionCircleOutlined,
  RobotOutlined,
  FileTextOutlined,
  PictureOutlined,
  VideoCameraOutlined,
  CodeOutlined,
  SendOutlined,
  LikeOutlined,
  DislikeOutlined,
} from '@ant-design/icons';
import type { QAItem } from '../types';

const { Title, Text } = Typography;
const { TextArea } = Input;

const Tutor: React.FC = () => {
  const [question, setQuestion] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentAnswer, setCurrentAnswer] = useState<QAItem | null>(null);
  const [history, setHistory] = useState<QAItem[]>([
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
  ]);

  const handleAsk = () => {
    if (!question.trim()) return;

    setIsGenerating(true);
    setQuestion('');

    // 模拟生成答案
    setTimeout(() => {
      const newQA: QAItem = {
        id: `qa-${Date.now()}`,
        question: question,
        answer: '正在为您分析问题并生成多模态解答，请稍候...',
        type: 'text',
        helpful: false,
        createdAt: new Date().toISOString(),
      };
      setHistory(prev => [newQA, ...prev]);
      setIsGenerating(false);
      message.success('问题已提交，智能辅导智能体正在分析...');
    }, 500);
  };

  const handleFeedback = (id: string, helpful: boolean) => {
    setHistory(prev => prev.map(item =>
      item.id === id ? { ...item, helpful } : item
    ));
    message.success(helpful ? '感谢您的肯定！' : '感谢反馈，我们会继续改进');
  };

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>智能辅导</Title>
      <Text type="secondary">即时答疑，提供多模态解答服务（文字、图解、视频、代码）</Text>

      {/* 解答模式切换 */}
      <Card style={{ marginTop: 24 }}>
        <Tabs
          defaultActiveKey="text"
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
                <Badge status="processing" text="运行中" />
              </Space>
            }
          >
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <TextArea
                rows={4}
                placeholder="输入你的问题，例如：什么是卷积神经网络？如何实现快速排序算法？..."
                value={question}
                onChange={e => setQuestion(e.target.value)}
              />
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleAsk}
                loading={isGenerating}
                block
                size="large"
              >
                提交问题
              </Button>
            </Space>

            {isGenerating && (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Avatar size="large" style={{ background: '#722ed1', marginBottom: 16 }} icon={<RobotOutlined />} />
                <div>
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
                  <Button type="link" size="small" onClick={() => setQuestion(item)}>
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
                        <Tag size="small" color={item.helpful ? 'success' : 'default'}>
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

      {/* 解答展示 */}
      {currentAnswer && (
        <Card title="解答详情" style={{ marginTop: 24 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text strong>{currentAnswer.question}</Text>
            <div style={{ padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
              <pre style={{ whiteSpace: 'pre-wrap' }}>{currentAnswer.answer}</pre>
            </div>
            <Space>
              <Button icon={<LikeOutlined />} onClick={() => handleFeedback(currentAnswer.id, true)}>
                有帮助
              </Button>
              <Button icon={<DislikeOutlined />} onClick={() => handleFeedback(currentAnswer.id, false)}>
                待改进
              </Button>
            </Space>
          </Space>
        </Card>
      )}
    </div>
  );
};

export default Tutor;
