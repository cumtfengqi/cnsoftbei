import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, Typography, Tag, Space, Button, Row, Col, List, Avatar, Input, Badge, Tabs, message, Spin, Modal, Popconfirm } from 'antd';
import {
  RobotOutlined,
  FileTextOutlined,
  PictureOutlined,
  VideoCameraOutlined,
  CodeOutlined,
  SendOutlined,
  LikeOutlined,
  DislikeOutlined,
  DeleteOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { streamChatCompletion } from '../services/api';
import { defaultTutorHistory, tutorQuickQuestions } from '../data/mockData';
import type { QAItem } from '../types';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { usePageCache } from '../context/PageCacheContext';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const PAGE_KEY = 'tutor';

const Tutor: React.FC = () => {
  const { cachedState, saveState } = usePageCache(PAGE_KEY);

  const [question, setQuestion] = useState(() => cachedState?.question ?? '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentAnswer, setCurrentAnswer] = useState(() => cachedState?.currentAnswer ?? '');
  const [activeMode, setActiveMode] = useState<'text' | 'image' | 'video' | 'code'>(() => cachedState?.activeMode ?? 'text');
  const [history, setHistory] = useState<QAItem[]>(() => cachedState?.history ?? defaultTutorHistory);
  const [selectedQA, setSelectedQA] = useState<QAItem | null>(null);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, 'like' | 'dislike' | null>>({});
  const [quickCache, setQuickCache] = useState<Record<string, string>>(() => cachedState?.quickCache ?? {});
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

  const answerRef = useRef<HTMLDivElement>(null);

  // 缓存状态变化
  useEffect(() => {
    saveState({ question, currentAnswer, activeMode, history, feedbackMap, quickCache, regeneratingId });
  }, [question, currentAnswer, activeMode, history, feedbackMap, quickCache, regeneratingId, saveState]);

  useEffect(() => {
    if (currentAnswer && answerRef.current) {
      answerRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentAnswer]);

  // 构建缓存 key
  const cacheKey = (q: string, mode: string) => `${q}|||${mode}`;

  const handleAsk = useCallback(async (inputQuestion?: string) => {
    const q = (inputQuestion ?? question).trim();
    if (!q) return;
    if (isGenerating) return;

    // 检查历史中是否已存在相同问题 + 相同模式
    const existingIndex = history.findIndex(item => item.question === q && item.type === activeMode);
    if (existingIndex >= 0) {
      const existing = history[existingIndex];
      const wasDisliked = feedbackMap[existing.id] === 'dislike';

      if (!wasDisliked) {
        // 未被踩：直接复用，将该项移至历史最前
        setCurrentAnswer(existing.answer);
        setHistory(prev => [existing, ...prev.filter((_, i) => i !== existingIndex)]);
        return;
      }

      // 曾被点踩：重新生成不同的回答，并分析原因
      if (!inputQuestion) setQuestion('');
      setIsGenerating(true);
      setCurrentAnswer('');
      setRegeneratingId(existing.id);

      try {
        const oldAnswer = existing.answer;

        const messages = [
          {
            role: 'system' as const,
            content: `你是一位专业的AI辅导老师。用户之前对以下回答点了"踩"，现在重新提问同一问题。你的任务是：
1. 简要分析之前的回答为什么让用户不满意（过于简略、不够准确、缺乏示例、结构不清等）
2. 给出一个明显不同的、更高质量的全新回答

请严格按以下格式输出（用markdown）：

## 📊 原因分析
（简要分析旧回答的不足之处，2-3句话）

## ✅ 重新解答
（全新的回答，必须与旧回答有明显差异：换角度讲解、补充细节、增加代码/图示示例等）`,
          },
          {
            role: 'user' as const,
            content: `原始问题：${existing.question}

之前的回答（用户不满意）：${oldAnswer.substring(0, 1500)}

请分析原因并重新解答。`,
          },
        ];

        let fullResponse = '';

        await streamChatCompletion(
          messages,
          (chunk, isThinking) => {
            if (!isThinking) {
              fullResponse += chunk;
              setCurrentAnswer(fullResponse);
            }
          },
          () => {}
        );

        const newAnswer = fullResponse || '重新生成失败，请稍后重试';

        setHistory(prev => {
          const idx = prev.findIndex(item => item.id === existing.id);
          if (idx < 0) return prev;
          const updated: QAItem = {
            ...prev[idx],
            answer: newAnswer,
            helpful: false,
            createdAt: new Date().toISOString(),
          };
          return [updated, ...prev.filter((_, i) => i !== idx)];
        });

        // 清除踩标记，允许重新评价
        setFeedbackMap(prev => ({ ...prev, [existing.id]: null }));

        const ck = cacheKey(existing.question, existing.type);
        setQuickCache(prev => ({ ...prev, [ck]: newAnswer }));

        message.success('已根据您的反馈重新生成回答');

      } catch (error: any) {
        console.error('Regeneration failed:', error);
        message.error('重新生成失败：' + error.message);
      } finally {
        setIsGenerating(false);
        setRegeneratingId(null);
      }
      return;
    }

    // 检查快捷问题缓存（缓存命中但历史中不存在的情况）
    const key = cacheKey(q, activeMode);
    const cached = quickCache[key];
    if (cached) {
      setCurrentAnswer(cached);
      const newQA: QAItem = {
        id: `qa-${Date.now()}`,
        question: q,
        answer: cached,
        type: activeMode,
        helpful: false,
        createdAt: new Date().toISOString(),
      };
      setHistory(prev => [newQA, ...prev]);
      message.success('已从缓存加载');
      return;
    }

    if (!inputQuestion) {
      setQuestion('');
    }
    setIsGenerating(true);
    setCurrentAnswer('');

    try {
      const modePrompts: Record<string, string> = {
        text: '你是一位专业的AI辅导老师，请详细解答用户的问题。用清晰的结构回答，包含必要的解释和示例。',
        image: '你是一位专业的AI辅导老师，请解答用户的问题并生成可视化图解说明。尽量用ASCII图或结构化方式来展示概念。',
        video: '你是一位专业的AI辅导老师，请为用户提供视频讲解脚本。内容包括开场、讲解步骤、总结，每部分时间控制在1分钟内。',
        code: '你是一位专业的编程老师，请为用户提供完整的代码示例。代码要包含注释和运行说明。',
      };

      const messages = [
        { role: 'system' as const, content: modePrompts[activeMode] || modePrompts.text },
        { role: 'user' as const, content: q },
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

      // 缓存结果
      setQuickCache(prev => ({ ...prev, [key]: fullAnswer }));

      // 保存到历史（再次检查避免并发重复，同时匹配问题和模式）
      setHistory(prev => {
        const dup = prev.findIndex(item => item.question === q && item.type === activeMode);
        if (dup >= 0) {
          // 已在处理期间被添加，复用现有项并置顶
          return [prev[dup], ...prev.filter((_, i) => i !== dup)];
        }
        const newQA: QAItem = {
          id: `qa-${Date.now()}`,
          question: q,
          answer: fullAnswer,
          type: activeMode as 'text' | 'image' | 'video' | 'code',
          helpful: false,
          createdAt: new Date().toISOString(),
        };
        return [newQA, ...prev];
      });
      message.success('解答完成！');

    } catch (error: any) {
      console.error('Tutor failed:', error);
      message.error('解答失败：' + error.message);
    } finally {
      setIsGenerating(false);
    }
  }, [question, isGenerating, activeMode, quickCache, history]);

  const handleFeedback = (id: string, helpful: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory(prev => prev.map(item =>
      item.id === id ? { ...item, helpful } : item
    ));
    setFeedbackMap(prev => ({ ...prev, [id]: helpful ? 'like' : 'dislike' }));
    message.success(helpful ? '感谢您的肯定！' : '感谢反馈，我们会继续改进');
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory(prev => prev.filter(item => item.id !== id));
    setFeedbackMap(prev => { const next = { ...prev }; delete next[id]; return next; });
    message.success('已删除该提问记录');
  };

  const handleViewDetail = (item: QAItem) => {
    setSelectedQA(item);
  };

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>智能辅导</Title>
      <Text type="secondary">即时答疑，提供多模态解答服务（文字、图解、视频、代码）</Text>

      {/* 解答模式切换 */}
      <Card style={{ marginTop: 24 }}>
        <Tabs
          activeKey={activeMode}
          onChange={(key) => setActiveMode(key as 'text' | 'image' | 'video' | 'code')}
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
                onClick={() => handleAsk()}
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
              dataSource={tutorQuickQuestions}
              renderItem={item => {
                const hasCached = !!quickCache[cacheKey(item, activeMode)];
                return (
                  <List.Item>
                    <Button
                      type="link"
                      size="small"
                      onClick={() => {
                        setQuestion(item);
                        // 有缓存则直接提交
                        if (hasCached) {
                          handleAsk(item);
                        }
                      }}
                      disabled={isGenerating}
                      style={{ textAlign: 'left', width: '100%', justifyContent: 'flex-start' }}
                    >
                      {item}
                      {hasCached && (
                        <Tag color="success" style={{ marginLeft: 8, fontSize: 10, lineHeight: '16px' }}>已缓存</Tag>
                      )}
                    </Button>
                  </List.Item>
                );
              }}
            />
          </Card>

          <Card title="历史提问" style={{ marginTop: 16 }}>
            {history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: '#999' }}>暂无提问记录</div>
            ) : (
              <List
                size="small"
                dataSource={history.slice(0, 10)}
                renderItem={item => (
                  <List.Item style={{ padding: '8px 0' }}>
                    {/* 整行可点击查看详情 */}
                    <div
                      onClick={() => handleViewDetail(item)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        width: '100%',
                        cursor: 'pointer',
                        padding: '4px 8px',
                        borderRadius: 6,
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#f5f5f5'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {item.type === 'code' ? <CodeOutlined /> : <FileTextOutlined />}
                          <Text
                            ellipsis
                            style={{ maxWidth: 140, fontSize: 13 }}
                          >
                            {item.question}
                          </Text>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                          {regeneratingId === item.id ? (
                            <Tag color="processing" icon={<LoadingOutlined spin />} style={{ fontSize: 11, lineHeight: '18px' }}>
                              重新生成中...
                            </Tag>
                          ) : (
                            <>
                              <Tag color={item.helpful ? 'success' : 'default'} style={{ fontSize: 11, lineHeight: '18px' }}>
                                {item.helpful ? '有帮助' : feedbackMap[item.id] === 'dislike' ? '已踩' : feedbackMap[item.id] === 'like' ? '已赞' : '待评价'}
                              </Tag>
                              <Button
                                type="text"
                                size="small"
                                icon={<LikeOutlined />}
                                onClick={(e) => handleFeedback(item.id, true, e)}
                                style={{
                                  color: feedbackMap[item.id] === 'like' ? '#1890ff' : '#999',
                                  fontSize: 14,
                                  padding: '0 4px',
                                  height: 22,
                                }}
                              />
                              <Button
                                type="text"
                                size="small"
                                icon={<DislikeOutlined />}
                                onClick={(e) => handleFeedback(item.id, false, e)}
                                style={{
                                  color: feedbackMap[item.id] === 'dislike' ? '#f5222d' : '#999',
                                  fontSize: 14,
                                  padding: '0 4px',
                                  height: 22,
                                }}
                              />
                            </>
                          )}
                        </div>
                      </div>
                      <Popconfirm
                        title="确认删除"
                        description="确定要删除这条提问记录吗？"
                        onConfirm={(e) => { handleDelete(item.id, e as unknown as React.MouseEvent); }}
                        okText="删除"
                        cancelText="取消"
                      >
                        <Button
                          type="text"
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={(e) => e.stopPropagation()}
                          style={{ flexShrink: 0 }}
                        />
                      </Popconfirm>
                    </div>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* 历史问答详情弹窗 */}
      <Modal
        title={
          <Space>
            {selectedQA?.type === 'code' ? <CodeOutlined /> : <FileTextOutlined />}
            <Text ellipsis style={{ maxWidth: 400 }}>提问详情</Text>
          </Space>
        }
        open={!!selectedQA}
        onCancel={() => setSelectedQA(null)}
        footer={null}
        width={700}
        destroyOnClose
      >
        {selectedQA && (
          <div>
            <Card size="small" style={{ background: '#e6f7ff', marginBottom: 16, border: '1px solid #91d5ff' }}>
              <Text strong>问题：</Text>
              <Paragraph style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>
                {selectedQA.question}
              </Paragraph>
              <Space style={{ marginTop: 8 }}>
                <Tag>{selectedQA.type === 'text' ? '文字解答' : selectedQA.type === 'code' ? '代码示例' : selectedQA.type === 'image' ? '图解说明' : '视频讲解'}</Tag>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {new Date(selectedQA.createdAt).toLocaleString()}
                </Text>
              </Space>
            </Card>
            <Card size="small" style={{ background: '#fafafa' }}>
              <Text strong>回答：</Text>
              <div style={{ marginTop: 8, maxHeight: 400, overflow: 'auto' }}>
                <MarkdownRenderer content={selectedQA.answer} />
              </div>
            </Card>
          </div>
        )}
      </Modal>

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