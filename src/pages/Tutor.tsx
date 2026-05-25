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
  CloseCircleOutlined,
  MessageOutlined,
} from '@ant-design/icons';
import { streamChatCompletion, chatCompletion } from '../services/api';
import { defaultTutorHistory, tutorQuickQuestions } from '../data/mockData';
import type { QAItem, StudentProfile } from '../types';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { usePageCache } from '../context/PageCacheContext';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const PAGE_KEY = 'tutor';

// 模块级引用，确保跨页面切换时后台生成不中断
const abortRef: { current: AbortController | null } = { current: null };
let pendingHistory: QAItem[] | null = null;
let pendingLastGeneratedId: string | null = null;
let pendingQuickCache: Record<string, string> | null = null;

function loadProfile(): StudentProfile | null {
  try {
    const saved = localStorage.getItem('studentProfile');
    if (!saved) return null;
    return JSON.parse(saved);
  } catch {
    return null;
  }
}

function buildProfileContext(profile: StudentProfile | null): string {
  if (!profile || !profile.dimensions?.length) return '';
  const dimMap: Record<string, string> = {};
  profile.dimensions.forEach(d => { dimMap[d.key] = d.value; });

  return `\n\n【当前学生画像】
- 姓名：${profile.name}，专业：${profile.major}，年级：${profile.grade}
- 知识基础：${dimMap.knowledgeBase || '未知'}
- 认知风格：${dimMap.cognitiveStyle || '未知'}
- 易错点：${dimMap.errorProne || '未知'}
- 学习节奏：${dimMap.learningPace || '未知'}
- 兴趣方向：${dimMap.interestDirection || '未知'}
- 学习习惯：${dimMap.studyHabit || '未知'}

请根据以上画像调整回答风格和深度。`;
}

const Tutor: React.FC = () => {
  const { cachedState, saveState } = usePageCache(PAGE_KEY);

  const [question, setQuestion] = useState(() => cachedState?.question ?? '');
  const [isGenerating, setIsGenerating] = useState(() => cachedState?.isGenerating ?? false);
  const [currentAnswer, setCurrentAnswer] = useState(() => cachedState?.currentAnswer ?? '');
  const [activeMode, setActiveMode] = useState<'text' | 'image' | 'video' | 'code'>(() => cachedState?.activeMode ?? 'text');
  const [history, setHistory] = useState<QAItem[]>(() => cachedState?.history ?? defaultTutorHistory);
  const [selectedQA, setSelectedQA] = useState<QAItem | null>(null);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, 'like' | 'dislike' | null>>({});
  const [quickCache, setQuickCache] = useState<Record<string, string>>(() => cachedState?.quickCache ?? {});
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [lastGeneratedId, setLastGeneratedId] = useState<string | null>(() => cachedState?.lastGeneratedId ?? null);
  // 追问状态：从历史点击追问时设置，不清理当前回答
  const [followUpParent, setFollowUpParent] = useState<QAItem | null>(() => cachedState?.followUpParent ?? null);

  const answerRef = useRef<HTMLDivElement>(null);
  const saveStateRef = useRef(saveState);
  saveStateRef.current = saveState;

  // 直接将进度写入页面缓存，确保跨页面切换不丢失
  const persistProgress = (overrides: Record<string, any>) => {
    saveStateRef.current({
      question, currentAnswer, activeMode, history, feedbackMap, quickCache,
      regeneratingId, followUpParent, lastGeneratedId, isGenerating,
      ...overrides,
    });
  };

  useEffect(() => {
    saveState({ question, currentAnswer, activeMode, history, feedbackMap, quickCache, regeneratingId, followUpParent, lastGeneratedId, isGenerating });
  }, [question, currentAnswer, activeMode, history, feedbackMap, quickCache, regeneratingId, followUpParent, lastGeneratedId, isGenerating, saveState]);

  useEffect(() => {
    if (currentAnswer && answerRef.current) {
      answerRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentAnswer]);

  const cacheKey = (q: string, mode: string) => `${q}|||${mode}`;
  const profile = loadProfile();
  const profileCtx = buildProfileContext(profile);

  const handleCancel = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsGenerating(false);
    persistProgress({ isGenerating: false });
  };

  // 解析上下文：自动检测用户输入是否与当前回答有关
  const resolveContext = (parentQA?: QAItem | null) => {
    // 明确指定的追问父项（从历史点击来）
    if (parentQA) return parentQA;
    // 追问状态
    if (followUpParent) return followUpParent;
    // 自动检测：当前有回答展示时，作为潜在上下文传给 AI 自行判断
    if (lastGeneratedId && currentAnswer) {
      const lastQA = history.find(h => h.id === lastGeneratedId);
      if (lastQA) return lastQA;
    }
    return null;
  };

  // AI 判断新问题是否与上一个问答相关
  const checkRelevance = async (newQuestion: string, prevQA: QAItem): Promise<boolean> => {
    try {
      const messages = [
        {
          role: 'system' as const,
          content: '你是一个问题相关性判断助手。判断用户的新问题是否与之前讨论的主题相关。仅回复"相关"或"无关"，不要输出其他任何内容。',
        },
        {
          role: 'user' as const,
          content: `之前的问题：${prevQA.question}\n之前的回答主题：${prevQA.answer.substring(0, 500)}\n\n新问题：${newQuestion}\n\n这两个问题是否属于同一主题？回复"相关"或"无关"。`,
        },
      ];
      const result = await chatCompletion(messages);
      return result.includes('相关') && !result.includes('无关');
    } catch {
      return false; // 判断失败时默认视为不相关，作为新问题处理
    }
  };

  const handleAsk = useCallback(async (inputQuestion?: string, parentQA?: QAItem | null) => {
    const q = (inputQuestion ?? question).trim();
    if (!q) return;
    if (isGenerating) return;
    setIsGenerating(true);

    const contextParent = resolveContext(parentQA);
    let isFollowUp = !!contextParent;

    // 有潜在上下文时，让 AI 判断是否真正相关
    if (contextParent) {
      const relevant = await checkRelevance(q, contextParent);
      if (!relevant) {
        isFollowUp = false;
        // 清除追问状态，把当前输入当作新问题
        if (followUpParent) setFollowUpParent(null);
      }
    }

    // 非追问时检查历史缓存
    if (!isFollowUp) {
      const existingIndex = history.findIndex(item => item.question === q && item.type === activeMode && !item.parentId);
      if (existingIndex >= 0) {
        const existing = history[existingIndex];
        const wasDisliked = feedbackMap[existing.id] === 'dislike';

        if (!wasDisliked) {
          setCurrentAnswer(existing.answer);
          setLastGeneratedId(existing.id);
          setFollowUpParent(null);
          setHistory(prev => [existing, ...prev.filter((_, i) => i !== existingIndex)]);
          setIsGenerating(false);
          return;
        }

        // 曾被点踩：重新生成
        if (!inputQuestion) setQuestion('');
        setCurrentAnswer('');
        setRegeneratingId(existing.id);

        const controller = new AbortController();
        abortRef.current = controller;

        let fullResponse = '';
        try {
          const oldAnswer = existing.answer;
          const messages = [
            {
              role: 'system' as const,
              content: `你是一位专业的AI辅导老师。用户对之前的回答点了"踩"，现在重新提问同一问题。${profileCtx}
1. 简要分析旧回答为什么让用户不满意
2. 给出全新的、明显不同的高质量回答

请严格按以下格式输出（用markdown）：
## 📊 原因分析
（2-3句话分析旧回答不足）
## ✅ 重新解答
（全新的回答）`,
            },
            {
              role: 'user' as const,
              content: `原始问题：${existing.question}\n\n之前的回答（用户不满意）：${oldAnswer.substring(0, 1500)}\n\n请分析原因并重新解答。`,
            },
          ];

          fullResponse = '';
          await streamChatCompletion(
            messages,
            (chunk, isThinking) => { if (!isThinking) { fullResponse += chunk; setCurrentAnswer(fullResponse); persistProgress({ isGenerating: true, currentAnswer: fullResponse }); } },
            () => {},
            controller.signal,
          );

          const newAnswer = fullResponse || '重新生成失败';
          setLastGeneratedId(existing.id);

          const idx = history.findIndex(item => item.id === existing.id);
          let newHistory: QAItem[];
          if (idx >= 0) {
            const updated: QAItem = { ...history[idx], answer: newAnswer, helpful: false, createdAt: new Date().toISOString() };
            newHistory = [updated, ...history.filter((_, i) => i !== idx)];
          } else {
            newHistory = history;
          }
          setHistory(newHistory);

          const newFeedbackMap = { ...feedbackMap, [existing.id]: null as 'like' | 'dislike' | null };
          setFeedbackMap(newFeedbackMap);

          const newQuickCache = { ...quickCache, [cacheKey(existing.question, existing.type)]: newAnswer };
          setQuickCache(newQuickCache);

          pendingHistory = newHistory;
          pendingLastGeneratedId = existing.id;
          pendingQuickCache = newQuickCache;

          message.success('已根据您的反馈重新生成回答');
        } catch (error: any) {
          if (error.name === 'AbortError') {
            message.info('已取消生成');
            const cancelledAnswer = fullResponse || '（已取消）';
            setLastGeneratedId(existing.id);
            const idx = history.findIndex(item => item.id === existing.id);
            let newHistory: QAItem[];
            if (idx >= 0) {
              const updated: QAItem = { ...history[idx], answer: cancelledAnswer, helpful: false, cancelled: true, createdAt: new Date().toISOString() };
              newHistory = [updated, ...history.filter((_, i) => i !== idx)];
            } else {
              newHistory = history;
            }
            setHistory(newHistory);
            pendingHistory = newHistory;
            pendingLastGeneratedId = existing.id;
          }
          else { console.error('Regeneration failed:', error); message.error('重新生成失败'); }
        } finally {
          setIsGenerating(false);
          setRegeneratingId(null);
          abortRef.current = null;
          persistProgress({
            isGenerating: false,
            regeneratingId: null,
            currentAnswer: fullResponse,
            ...(pendingHistory ? { history: pendingHistory, lastGeneratedId: pendingLastGeneratedId } : {}),
            ...(pendingQuickCache ? { quickCache: pendingQuickCache } : {}),
          });
          pendingHistory = null;
          pendingLastGeneratedId = null;
          pendingQuickCache = null;
        }
        return;
      }

      // 检查快捷缓存
      const key = cacheKey(q, activeMode);
      const cached = quickCache[key];
      if (cached) {
        setCurrentAnswer(cached);
        setFollowUpParent(null);
        setIsGenerating(false);
        message.success('已从缓存加载');
        return;
      }
    }

    if (!inputQuestion) setQuestion('');
    setCurrentAnswer('');

    const controller = new AbortController();
    abortRef.current = controller;

    let fullAnswer = '';
    try {
      const modePrompts: Record<string, string> = {
        text: '你是一位专业的AI辅导老师，请详细解答用户的问题。用清晰的结构回答，包含必要的解释和示例。',
        image: '你是一位专业的AI辅导老师，请解答用户的问题并生成可视化图解说明。尽量用ASCII图或结构化方式来展示概念。',
        video: '你是一位专业的AI辅导老师，请为用户提供视频讲解脚本。内容包括开场、讲解步骤、总结，每部分时间控制在1分钟内。',
        code: '你是一位专业的编程老师，请为用户提供完整的代码示例。代码要包含注释和运行说明。',
      };

      let systemPrompt = modePrompts[activeMode] || modePrompts.text;
      systemPrompt += profileCtx;

      let userContent = q;
      if (isFollowUp && contextParent) {
        systemPrompt += `\n\n用户可能正在基于之前的回答进行追问或提出新问题。请根据上下文判断：
- 如果新问题与之前的问答主题相关 → 将其视为追问，结合上下文给出连贯深入的回复
- 如果新问题与之前的问答完全无关 → 将其视为全新问题，忽略之前的上下文

注意：不要显式输出你的判断过程，直接给出最合适的回答。`;
        userContent = `之前的问答：\n问：${contextParent.question}\n答：${contextParent.answer.substring(0, 2000)}\n\n用户的新输入：${q}`;
      }

      const messages = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: userContent },
      ];

      fullAnswer = '';
      await streamChatCompletion(
        messages,
        (chunk, isThinking) => { if (!isThinking) { fullAnswer += chunk; setCurrentAnswer(fullAnswer); persistProgress({ isGenerating: true, currentAnswer: fullAnswer }); } },
        () => {},
        controller.signal,
      );

      // 构建新的快速缓存
      let newQuickCache = quickCache;
      if (!isFollowUp) {
        newQuickCache = { ...quickCache, [cacheKey(q, activeMode)]: fullAnswer };
        setQuickCache(newQuickCache);
      }

      // 构建新的 QA 和历史记录
      const qaId = `qa-${Date.now()}`;
      const newQA: QAItem = {
        id: qaId,
        question: q,
        answer: fullAnswer,
        type: activeMode as 'text' | 'image' | 'video' | 'code',
        helpful: false,
        createdAt: new Date().toISOString(),
      };

      let newHistory: QAItem[];
      if (isFollowUp && contextParent) {
        newQA.parentId = contextParent.id;
        newHistory = history.map(item =>
          item.id === contextParent.id
            ? { ...item, followUpIds: [...(item.followUpIds || []), newQA.id] }
            : item
        ).concat([newQA]);
      } else {
        const dup = history.findIndex(item => item.question === q && item.type === activeMode && !item.parentId);
        if (dup >= 0) {
          newHistory = [history[dup], ...history.filter((_, i) => i !== dup)];
        } else {
          newHistory = [newQA, ...history];
        }
      }

      setLastGeneratedId(qaId);
      setHistory(newHistory);
      pendingHistory = newHistory;
      pendingLastGeneratedId = qaId;
      pendingQuickCache = newQuickCache;

      // 追问完成后清除追问状态
      if (followUpParent) setFollowUpParent(null);

      message.success(isFollowUp ? '已回复' : '解答完成！');
    } catch (error: any) {
      if (error.name === 'AbortError') {
        message.info('已取消生成');
        const qaId = `qa-${Date.now()}`;
        const cancelledQA: QAItem = {
          id: qaId,
          question: q,
          answer: fullAnswer || '（已取消）',
          type: activeMode as 'text' | 'image' | 'video' | 'code',
          helpful: false,
          cancelled: true,
          createdAt: new Date().toISOString(),
        };
        let newHistory: QAItem[];
        if (isFollowUp && contextParent) {
          cancelledQA.parentId = contextParent.id;
          newHistory = history.map(item =>
            item.id === contextParent.id
              ? { ...item, followUpIds: [...(item.followUpIds || []), cancelledQA.id] }
              : item
          ).concat([cancelledQA]);
        } else {
          newHistory = [cancelledQA, ...history];
        }
        setHistory(newHistory);
        setLastGeneratedId(qaId);
        pendingHistory = newHistory;
        pendingLastGeneratedId = qaId;
        if (followUpParent) setFollowUpParent(null);
      }
      else { console.error('Tutor failed:', error); message.error('解答失败：' + error.message); }
    } finally {
      setIsGenerating(false);
      abortRef.current = null;
      persistProgress({
        isGenerating: false,
        currentAnswer: fullAnswer,
        ...(pendingHistory ? { history: pendingHistory, lastGeneratedId: pendingLastGeneratedId } : {}),
        ...(pendingQuickCache ? { quickCache: pendingQuickCache } : {}),
      });
      pendingHistory = null;
      pendingLastGeneratedId = null;
      pendingQuickCache = null;
    }
  }, [question, isGenerating, activeMode, quickCache, history, feedbackMap, followUpParent, profileCtx, lastGeneratedId, currentAnswer]);

  const handleFeedback = (id: string, helpful: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory(prev => prev.map(item => item.id === id ? { ...item, helpful } : item));
    setFeedbackMap(prev => ({ ...prev, [id]: helpful ? 'like' : 'dislike' }));
    message.success(helpful ? '感谢您的肯定！' : '感谢反馈，我们会继续改进');
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory(prev => {
      const idsToRemove = new Set([id]);
      const item = prev.find(i => i.id === id);
      if (item?.followUpIds) item.followUpIds.forEach(fid => idsToRemove.add(fid));
      return prev.filter(item => !idsToRemove.has(item.id));
    });
    setFeedbackMap(prev => { const next = { ...prev }; delete next[id]; return next; });
    message.success('已删除该提问记录');
  };

  const handleViewDetail = (item: QAItem) => {
    setSelectedQA(item);
  };

  // 从历史点击追问：不清理当前回答，仅设置追问目标
  const handleStartFollowUp = (item: QAItem) => {
    setFollowUpParent(item);
    setQuestion('');
    message.info(`追问：「${item.question.substring(0, 30)}...」——请输入你的追问内容`);
  };

  const handleCancelFollowUp = () => {
    setFollowUpParent(null);
    setQuestion('');
  };

  const topLevelHistory = history.filter(item => !item.parentId);

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>智能辅导</Title>
      <Text type="secondary">即时答疑，提供多模态解答服务（文字、图解、视频、代码）</Text>

      <Card style={{ marginTop: 24 }}>
        <Tabs
          activeKey={activeMode}
          onChange={(key) => setActiveMode(key as 'text' | 'image' | 'video' | 'code')}
          items={[
            { key: 'text', label: <span><FileTextOutlined /> 文字解答</span>, children: <div style={{ padding: 16, background: '#fafafa', borderRadius: 8 }}><Text type="secondary">提供详细的文字解释和分析步骤</Text></div> },
            { key: 'image', label: <span><PictureOutlined /> 图解说明</span>, children: <div style={{ padding: 16, background: '#fafafa', borderRadius: 8 }}><Text type="secondary">提供可视化图解，帮助理解复杂概念</Text></div> },
            { key: 'video', label: <span><VideoCameraOutlined /> 视频讲解</span>, children: <div style={{ padding: 16, background: '#fafafa', borderRadius: 8 }}><Text type="secondary">提供短视频讲解，step by step演示</Text></div> },
            { key: 'code', label: <span><CodeOutlined /> 代码示例</span>, children: <div style={{ padding: 16, background: '#fafafa', borderRadius: 8 }}><Text type="secondary">提供完整的代码示例和运行结果</Text></div> },
          ]}
        />
      </Card>

      <Row gutter={24} style={{ marginTop: 24 }}>
        <Col span={16}>
          <Card
            title={
              <Space>
                <Avatar style={{ background: '#722ed1' }} icon={<RobotOutlined />} />
                <span>智能辅导智能体</span>
                {profile && <Tag color="blue" style={{ fontSize: 11 }}>已关联画像</Tag>}
                {isGenerating ? (
                  <Tag color="processing" icon={<LoadingOutlined />}>生成中</Tag>
                ) : (
                  <Badge status="processing" text="运行中" />
                )}
              </Space>
            }
          >
            {/* 追问提示条 */}
            {followUpParent && (
              <div style={{
                marginBottom: 12, padding: '8px 12px', background: '#f6ffed',
                border: '1px solid #b7eb8f', borderRadius: 6,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <Space>
                  <MessageOutlined style={{ color: '#52c41a' }} />
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    追问：<Text strong>{followUpParent.question.substring(0, 40)}...</Text>
                  </Text>
                </Space>
                <Button size="small" icon={<CloseCircleOutlined />} onClick={handleCancelFollowUp}>取消追问</Button>
              </div>
            )}

            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <TextArea
                rows={4}
                placeholder={followUpParent
                  ? '输入你的追问内容...'
                  : currentAnswer
                  ? '可以继续追问，或输入新问题...'
                  : '输入你的问题，例如：什么是卷积神经网络？...'}
                value={question}
                onChange={e => setQuestion(e.target.value)}
                onPressEnter={(e) => {
                  if (!e.shiftKey) { e.preventDefault(); handleAsk(); }
                }}
                disabled={isGenerating}
              />
              <Space style={{ width: '100%' }}>
                <Button type="primary" icon={isGenerating ? <LoadingOutlined /> : <SendOutlined />}
                  onClick={() => handleAsk()} loading={isGenerating} block size="large">
                  {isGenerating ? '正在生成...' : '提交'}
                </Button>
                {isGenerating && (
                  <Button danger icon={<CloseCircleOutlined />} onClick={handleCancel} size="large">取消</Button>
                )}
              </Space>
            </Space>

            {/* 当前回答展示 */}
            {currentAnswer && (() => {
              const currentQA = lastGeneratedId ? history.find(h => h.id === lastGeneratedId) : null;
              const parentQA = currentQA?.parentId ? history.find(h => h.id === currentQA.parentId) : null;
              const displayParent = followUpParent || parentQA;
              return (
              <div style={{ marginTop: 24, padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
                {/* 追问关联的原始问题 */}
                {displayParent && (
                  <Card size="small" style={{ marginBottom: 12, background: '#fffbe6', border: '1px solid #ffe58f' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>关联问题：</Text>
                    <Paragraph style={{ marginTop: 4, marginBottom: 0, fontWeight: 500, fontSize: 14 }}>
                      {displayParent.question}
                    </Paragraph>
                  </Card>
                )}
                <Space style={{ marginBottom: 8 }}>
                  <Tag color="purple">{activeMode === 'text' ? '文字解答' : activeMode === 'image' ? '图解说明' : activeMode === 'video' ? '视频讲解' : '代码示例'}</Tag>
                  {displayParent && <Tag color="green">追问</Tag>}
                  {currentQA?.cancelled && <Tag color="default">已取消</Tag>}
                  {isGenerating && <Tag color="processing" icon={<LoadingOutlined />}>生成中</Tag>}
                </Space>
                <div ref={answerRef as any} style={{ maxHeight: 400, overflow: 'auto', padding: 16, borderRadius: 8, background: '#fff' }}>
                  <MarkdownRenderer content={currentAnswer} />
                  {isGenerating && <span style={{ animation: 'blink 1s infinite', marginLeft: 4 }}>|</span>}
                </div>
              </div>
              );
            })()}

            {isGenerating && !currentAnswer && (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Spin size="large" />
                <div style={{ marginTop: 16 }}>
                  <Text>智能辅导智能体正在分析您的问题...</Text>
                </div>
              </div>
            )}
          </Card>
        </Col>

        <Col span={8}>
          <Card title="常见快捷问题" extra={<Tag color="purple">推荐</Tag>}>
            <List
              size="small"
              dataSource={tutorQuickQuestions}
              renderItem={item => {
                const hasCached = !!quickCache[cacheKey(item, activeMode)];
                return (
                  <List.Item>
                    <Button type="link" size="small"
                      onClick={() => { setQuestion(item); setFollowUpParent(null); if (hasCached) handleAsk(item); }}
                      disabled={isGenerating}
                      style={{ textAlign: 'left', width: '100%', justifyContent: 'flex-start', color: hasCached ? '#722ed1' : undefined }}>
                      {item}
                    </Button>
                  </List.Item>
                );
              }}
            />
          </Card>

          <Card title="历史提问" style={{ marginTop: 16 }}>
            {topLevelHistory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: '#999' }}>暂无提问记录</div>
            ) : (
              <List
                size="small"
                dataSource={topLevelHistory.slice(0, 10)}
                renderItem={item => {
                  const followUps = history.filter(h => h.parentId === item.id);
                  return (
                    <List.Item style={{ padding: '4px 0' }}>
                      <div style={{ width: '100%' }}>
                        <div
                          onClick={() => handleViewDetail(item)}
                          style={{
                            display: 'flex', alignItems: 'center', width: '100%',
                            cursor: 'pointer', padding: '4px 8px', borderRadius: 6,
                            transition: 'background 0.2s',
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#f5f5f5'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {item.type === 'code' ? <CodeOutlined /> : <FileTextOutlined />}
                              <Text ellipsis style={{ maxWidth: 120, fontSize: 13 }}>{item.question}</Text>
                              {followUps.length > 0 && <Tag color="green" style={{ fontSize: 10, lineHeight: '16px' }}>{followUps.length}条追问</Tag>}
                              {item.cancelled && <Tag color="default" style={{ fontSize: 10, lineHeight: '16px' }}>已取消</Tag>}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                              {item.cancelled ? (
                                <Tag color="default" style={{ fontSize: 11, lineHeight: '18px' }}>已取消</Tag>
                              ) : regeneratingId === item.id ? (
                                <Tag color="processing" icon={<LoadingOutlined spin />} style={{ fontSize: 11, lineHeight: '18px' }}>重新生成中...</Tag>
                              ) : (
                                <>
                                  <Tag color={item.helpful ? 'success' : 'default'} style={{ fontSize: 11, lineHeight: '18px' }}>
                                    {item.helpful ? '有帮助' : feedbackMap[item.id] === 'dislike' ? '已踩' : feedbackMap[item.id] === 'like' ? '已赞' : '待评价'}
                                  </Tag>
                                  <Button type="text" size="small" icon={<LikeOutlined />}
                                    onClick={(e) => handleFeedback(item.id, true, e)}
                                    style={{ color: feedbackMap[item.id] === 'like' ? '#1890ff' : '#999', fontSize: 14, padding: '0 4px', height: 22 }} />
                                  <Button type="text" size="small" icon={<DislikeOutlined />}
                                    onClick={(e) => handleFeedback(item.id, false, e)}
                                    style={{ color: feedbackMap[item.id] === 'dislike' ? '#f5222d' : '#999', fontSize: 14, padding: '0 4px', height: 22 }} />
                                  <Button type="text" size="small" icon={<MessageOutlined />}
                                    onClick={(e) => { e.stopPropagation(); handleStartFollowUp(item); }}
                                    style={{ color: '#52c41a', fontSize: 14, padding: '0 4px', height: 22 }} title="追问" />
                                </>
                              )}
                            </div>
                          </div>
                          <span onClick={(e) => e.stopPropagation()}>
                            <Popconfirm title="确认删除" description="确定要删除这条提问记录吗？"
                              onConfirm={(e) => { handleDelete(item.id, e as unknown as React.MouseEvent); }}
                              okText="删除" cancelText="取消">
                              <Button type="text" size="small" danger icon={<DeleteOutlined />}
                                style={{ flexShrink: 0 }} />
                            </Popconfirm>
                          </span>
                        </div>
                        {/* 追问子条目 */}
                        {followUps.length > 0 && (
                          <div style={{ marginLeft: 24, borderLeft: '2px solid #e8e8e8', paddingLeft: 8 }}>
                            {followUps.slice(0, 3).map(fu => (
                              <div key={fu.id} onClick={() => handleViewDetail(fu)}
                                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 6px', cursor: 'pointer', borderRadius: 4, fontSize: 12 }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#f5f5f5'; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}>
                                <MessageOutlined style={{ fontSize: 11, color: fu.cancelled ? '#999' : '#52c41a' }} />
                                <Text ellipsis style={{ maxWidth: 100, color: fu.cancelled ? '#999' : '#666' }}>{fu.question}</Text>
                                {fu.cancelled ? (
                                  <Tag color="default" style={{ fontSize: 10, lineHeight: '16px', marginLeft: 'auto' }}>已取消</Tag>
                                ) : (
                                  <Tag color={fu.helpful ? 'success' : 'default'} style={{ fontSize: 10, lineHeight: '16px', marginLeft: 'auto' }}>
                                    {fu.helpful ? '有帮助' : feedbackMap[fu.id] === 'dislike' ? '已踩' : feedbackMap[fu.id] === 'like' ? '已赞' : ''}
                                  </Tag>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </List.Item>
                  );
                }}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* 详情弹窗 */}
      <Modal
        title={
          <Space>
            {selectedQA?.type === 'code' ? <CodeOutlined /> : <FileTextOutlined />}
            <Text ellipsis style={{ maxWidth: 400 }}>提问详情</Text>
            {selectedQA?.parentId && <Tag color="green">追问</Tag>}
            {selectedQA?.cancelled && <Tag color="default">已取消</Tag>}
          </Space>
        }
        open={!!selectedQA}
        onCancel={() => setSelectedQA(null)}
        footer={
          selectedQA ? (
            <Space>
              {!selectedQA.cancelled && (
                <Button icon={<MessageOutlined />}
                  onClick={() => { setSelectedQA(null); handleStartFollowUp(selectedQA); }}>追问</Button>
              )}
              <Button onClick={() => setSelectedQA(null)}>关闭</Button>
            </Space>
          ) : null
        }
        width={700}
        destroyOnClose
      >
        {selectedQA && (
          <div>
            {selectedQA.parentId && (() => {
              const parent = history.find(h => h.id === selectedQA.parentId);
              return parent ? (
                <Card size="small" style={{ background: '#fffbe6', marginBottom: 12, border: '1px solid #ffe58f' }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>原始问题：</Text>
                  <Paragraph style={{ marginTop: 4, whiteSpace: 'pre-wrap', fontSize: 13 }} ellipsis={{ rows: 3, expandable: true }}>
                    {parent.question}
                  </Paragraph>
                </Card>
              ) : null;
            })()}
            <Card size="small" style={{ background: '#e6f7ff', marginBottom: 16, border: '1px solid #91d5ff' }}>
              <Text strong>{selectedQA.parentId ? '追问：' : '问题：'}</Text>
              <Paragraph style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{selectedQA.question}</Paragraph>
              <Space style={{ marginTop: 8 }}>
                <Tag>{selectedQA.type === 'text' ? '文字解答' : selectedQA.type === 'code' ? '代码示例' : selectedQA.type === 'image' ? '图解说明' : '视频讲解'}</Tag>
                <Text type="secondary" style={{ fontSize: 12 }}>{new Date(selectedQA.createdAt).toLocaleString()}</Text>
              </Space>
            </Card>
            <Card size="small" style={{ background: '#fafafa' }}>
              <Text strong>回答：</Text>
              <div style={{ marginTop: 8, maxHeight: 400, overflow: 'auto' }}>
                <MarkdownRenderer content={selectedQA.answer} />
              </div>
            </Card>
            {selectedQA.followUpIds && selectedQA.followUpIds.length > 0 && (
              <Card size="small" title={`追问 (${selectedQA.followUpIds.length})`} style={{ marginTop: 16 }}>
                {history.filter(h => selectedQA.followUpIds?.includes(h.id)).map(fu => (
                  <Card key={fu.id} size="small" style={{ marginBottom: 8, background: fu.cancelled ? '#fafafa' : '#f6ffed', border: fu.cancelled ? '1px solid #d9d9d9' : '1px solid #b7eb8f' }}>
                    <Text strong style={{ fontSize: 13 }}>追问：{fu.question}</Text>
                    {fu.cancelled && <Tag color="default" style={{ marginLeft: 8, fontSize: 11 }}>已取消</Tag>}
                    <div style={{ marginTop: 4, maxHeight: 120, overflow: 'auto' }}>
                      <MarkdownRenderer content={fu.answer} />
                    </div>
                  </Card>
                ))}
              </Card>
            )}
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