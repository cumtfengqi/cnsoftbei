import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Typography, Tag, Space, Button, Row, Col, Progress, Radio,
  Input, Spin, message, Avatar, Divider, Collapse,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  RocketOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { PracticeQuestion, ModuleProgress } from '../types';
import {
  learningPlan,
  questions,
  checkAnswer,
  gradeByAI,
  submitAnswer,
  getOrCreatePracticeState,
  resetPracticeState,
} from '../services/practiceGrader';
import { usePageCache } from '../context/PageCacheContext';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Panel } = Collapse;

const PAGE_KEY = 'practice';
const BATCH_SIZE = 5;

interface QuestionResult {
  questionId: string;
  userAnswer: string;
  isCorrect: boolean | null;
  aiScore?: number;
  isSubmitted: boolean;
}

const Practice: React.FC = () => {
  const { cachedState, saveState } = usePageCache(PAGE_KEY);

  const [activeModuleId, setActiveModuleId] = useState<string>(() =>
    cachedState?.activeModuleId ?? learningPlan.modules[0].id
  );

  const [batchIndex, setBatchIndex] = useState<number>(() => cachedState?.batchIndex ?? 0);

  const [results, setResults] = useState<Record<string, QuestionResult>>(() =>
    cachedState?.results ?? {}
  );

  // 每道题的作答内容（按题目ID独立存储）
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // 批量提交状态
  const [isBatchSubmitting, setIsBatchSubmitting] = useState(false);
  const [isAiGrading, setIsAiGrading] = useState(false);
  const [aiGradeText, setAiGradeText] = useState('');
  const [gradingQuestionId, setGradingQuestionId] = useState<string | null>(null);

  const [moduleProgress, setModuleProgress] = useState<ModuleProgress[]>(() => {
    const state = getOrCreatePracticeState();
    return state.moduleProgress;
  });

  useEffect(() => {
    saveState({ activeModuleId, batchIndex, results });
  }, [activeModuleId, batchIndex, results, saveState]);

  const moduleQuestions = questions.filter(q => q.moduleId === activeModuleId);
  const totalBatches = Math.ceil(moduleQuestions.length / BATCH_SIZE);

  const currentBatchQuestions = moduleQuestions.slice(
    batchIndex * BATCH_SIZE,
    (batchIndex + 1) * BATCH_SIZE
  );

  const getQuestionResult = useCallback(
    (qId: string) => results[qId],
    [results]
  );

  const totalQuestions = questions.length;
  const completedCount = Object.keys(results).filter(id => results[id].isSubmitted).length;
  const correctCount = Object.values(results).filter(r => r.isSubmitted && r.isCorrect).length;
  const totalScore = totalQuestions > 0 ? Math.round((correctCount / completedCount) * 100) || 0 : 0;

  // 当前批次：是否全部已提交
  const currentBatchAllSubmitted = currentBatchQuestions.every(
    q => !!getQuestionResult(q.id)?.isSubmitted
  );

  // 当前批次：是否有至少一道题已作答但未提交
  const currentBatchHasAnswer = currentBatchQuestions.some(
    q => !getQuestionResult(q.id)?.isSubmitted && !!answers[q.id]?.trim()
  );

  // 批量提交当前批次
  const handleBatchSubmit = async () => {
    // 收集未提交且有作答的题目
    const toSubmit = currentBatchQuestions.filter(
      q => !getQuestionResult(q.id)?.isSubmitted && !!answers[q.id]?.trim()
    );

    if (toSubmit.length === 0) {
      message.warning('请先作答至少一道题');
      return;
    }

    setIsBatchSubmitting(true);
    setIsAiGrading(true);
    setAiGradeText('');

    const newResults = { ...results };
    try {
      // 逐题处理：客观题即时判分，简答题调用 AI
      for (const q of toSubmit) {
        const selectedAnswer = answers[q.id] ?? '';

        if (q.type === 'short') {
          // 简答题：显示当前 AI 判分的题目
          setGradingQuestionId(q.id);
          setAiGradeText('');
          try {
            const score = await gradeByAI(q, selectedAnswer, (text) => {
              setAiGradeText(prev => prev + text);
            });
            const finalIsCorrect = score >= 50;
            newResults[q.id] = {
              questionId: q.id,
              userAnswer: selectedAnswer,
              isCorrect: finalIsCorrect,
              aiScore: score,
              isSubmitted: true,
            };
            // 逐题持久化
            submitAnswer(q.id, selectedAnswer, null, score);
          } catch {
            newResults[q.id] = {
              questionId: q.id,
              userAnswer: selectedAnswer,
              isCorrect: null,
              aiScore: 0,
              isSubmitted: true,
            };
          }
        } else {
          // 客观题：即时判分
          const isCorrect = checkAnswer(q, selectedAnswer);
          newResults[q.id] = {
            questionId: q.id,
            userAnswer: selectedAnswer,
            isCorrect,
            isSubmitted: true,
          };
          submitAnswer(q.id, selectedAnswer, isCorrect);
        }

        setResults({ ...newResults });
        setModuleProgress(getOrCreatePracticeState().moduleProgress);
      }

      // 清除本批次作答内容
      setAnswers(prev => {
        const next = { ...prev };
        toSubmit.forEach(q => { delete next[q.id]; });
        return next;
      });

      const correct = toSubmit.filter(q => newResults[q.id].isCorrect).length;
      message.success(`本批次提交完成！正确 ${correct}/${toSubmit.length} 题`);

    } catch (err) {
      console.error('Batch submit failed:', err);
      message.error('提交失败，请重试');
    } finally {
      setIsBatchSubmitting(false);
      setIsAiGrading(false);
      setGradingQuestionId(null);
      setAiGradeText('');
    }
  };

  // 重置答题
  const handleReset = () => {
    const state = resetPracticeState();
    setResults({});
    setModuleProgress(state.moduleProgress);
    setBatchIndex(0);
    setAnswers({});
    message.success('练习记录已重置');
  };

  // 渲染题目
  const renderQuestion = (question: PracticeQuestion, globalIndex: number) => {
    const result = getQuestionResult(question.id);
    const isSubmitted = result?.isSubmitted;
    const isCorrect = result?.isCorrect;
    const isAiGradingThis = isAiGrading && gradingQuestionId === question.id;

    return (
      <Card
        key={question.id}
        size="small"
        style={{
          marginBottom: 16,
          borderLeft: `4px solid ${
            isSubmitted
              ? isCorrect
                ? '#52c41a'
                : isCorrect === false
                ? '#f5222d'
                : '#faad14'
              : '#d9d9d9'
          }`,
          background: isSubmitted ? '#fafafa' : '#fff',
        }}
      >
        <Space style={{ marginBottom: 12 }}>
          <Tag color={
            question.difficulty === 'easy' ? 'green' :
            question.difficulty === 'medium' ? 'orange' : 'red'
          }>
            {question.difficulty === 'easy' ? '简单' : question.difficulty === 'medium' ? '中等' : '困难'}
          </Tag>
          <Tag color={
            question.type === 'choice' ? 'blue' :
            question.type === 'truefalse' ? 'cyan' : 'purple'
          }>
            {question.type === 'choice' ? '选择题' : question.type === 'truefalse' ? '判断题' : '简答题'}
          </Tag>
          {question.tags.slice(0, 2).map(tag => (
            <Tag key={tag} style={{ fontSize: 11 }}>{tag}</Tag>
          ))}
        </Space>

        <Title level={5} style={{ margin: '8px 0' }}>
          {globalIndex}. {question.question}
        </Title>

        {!isSubmitted ? (
          <>
            {/* 选择题/判断题 */}
            {(question.type === 'choice' || question.type === 'truefalse') && (
              <Radio.Group
                value={answers[question.id] ?? ''}
                onChange={e => {
                  if (!getQuestionResult(question.id)?.isSubmitted) {
                    setAnswers(prev => ({ ...prev, [question.id]: e.target.value }));
                  }
                }}
                style={{ width: '100%' }}
              >
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                  {(question.type === 'choice' ? (question.options ?? []) : ['正确', '错误']).map((opt, idx) => {
                    const optValue = question.type === 'choice'
                      ? opt
                      : (idx === 0 ? 'true' : 'false');
                    const isSelected = answers[question.id] === optValue;
                    return (
                      <Radio
                        key={idx}
                        value={optValue}
                        style={{
                          display: 'block',
                          padding: '10px 14px',
                          background: isSelected ? '#e6f4ff' : '#fff',
                          borderRadius: 6,
                          border: isSelected ? '1px solid #1890ff' : '1px solid #d9d9d9',
                          width: '100%',
                        }}
                      >
                        {question.type === 'choice' ? (
                          <Text>
                            <Text strong style={{ marginRight: 8 }}>
                              {String.fromCharCode(65 + idx)}.
                            </Text>
                            {opt}
                          </Text>
                        ) : (
                          <Text strong>{opt}</Text>
                        )}
                      </Radio>
                    );
                  })}
                </Space>
              </Radio.Group>
            )}

            {/* 简答题 */}
            {question.type === 'short' && (
              <>
                <TextArea
                  rows={4}
                  placeholder="请在下方输入你的答案..."
                  value={answers[question.id] ?? ''}
                  onChange={e => {
                    if (!getQuestionResult(question.id)?.isSubmitted) {
                      setAnswers(prev => ({ ...prev, [question.id]: e.target.value }));
                    }
                  }}
                  disabled={isAiGrading}
                />
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                  参考答案将在提交后显示
                </Text>
              </>
            )}

            {/* AI 正在判分此题 */}
            {isAiGradingThis && (
              <Card
                size="small"
                style={{ marginTop: 12, background: '#f0f5ff', border: '1px solid #adc6ff' }}
              >
                <Space>
                  <Spin size="small" />
                  <Text>AI 正在评分此题...</Text>
                </Space>
                {aiGradeText && (
                  <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                    {aiGradeText.substring(0, 100)}
                  </div>
                )}
              </Card>
            )}
          </>
        ) : (
          /* 已提交：显示结果 */
          <>
            <div style={{
              padding: '8px 12px',
              background: isCorrect ? '#f6ffed' : '#fff2f0',
              borderRadius: 6,
              marginBottom: 12,
              border: `1px solid ${isCorrect ? '#b7eb8f' : '#ffccc7'}`,
            }}>
              <Space>
                {isCorrect ? (
                  <CheckCircleOutlined style={{ color: '#52c41a' }} />
                ) : (
                  <CloseCircleOutlined style={{ color: '#f5222d' }} />
                )}
                <Text strong style={{ color: isCorrect ? '#52c41a' : '#f5222d' }}>
                  {isCorrect === null
                    ? `AI 评分: ${result.aiScore ?? 0} 分`
                    : isCorrect
                    ? '回答正确'
                    : '回答错误'}
                </Text>
              </Space>
              {question.type !== 'short' && (
                <Text type="secondary" style={{ marginLeft: 16 }}>
                  你的答案: {result.userAnswer}
                  {question.type === 'choice' && question.options && (
                    <Text type="secondary"> ({
                      String.fromCharCode(65 + (question.options as string[]).indexOf(result.userAnswer))
                    })</Text>
                  )}
                </Text>
              )}
              {question.type === 'short' && (
                <div style={{ marginTop: 8 }}>
                  <Text strong>你的答案：</Text>
                  <Paragraph style={{ marginTop: 4, whiteSpace: 'pre-wrap', fontSize: 13 }}>
                    {result.userAnswer}
                  </Paragraph>
                </div>
              )}
            </div>

            {/* 判断题/选择题显示正确答案 */}
            {question.type !== 'short' && question.trueFalseAnswer !== undefined && (
              <Text type="secondary">
                正确答案：{question.trueFalseAnswer ? '正确' : '错误'}
              </Text>
            )}
            {question.type === 'choice' && question.correctAnswer && question.options && (
              <Text type="secondary">
                正确答案：{String.fromCharCode(65 + (question.options as string[]).indexOf(question.correctAnswer))}. {question.correctAnswer}
              </Text>
            )}

            {/* 简答题参考答案 */}
            {question.type === 'short' && question.sampleAnswer && (
              <div style={{ marginTop: 8 }}>
                <Text strong>参考答案：</Text>
                <Paragraph style={{ marginTop: 4, whiteSpace: 'pre-wrap', fontSize: 13, color: '#555' }}>
                  {question.sampleAnswer}
                </Paragraph>
              </div>
            )}

            {/* 解析 */}
            {question.explanation && (
              <div style={{ marginTop: 8, padding: '8px', background: '#f5f5f5', borderRadius: 4 }}>
                <Text strong style={{ fontSize: 12 }}>💡 解析：</Text>
                <Text style={{ fontSize: 12 }}> {question.explanation}</Text>
              </div>
            )}
          </>
        )}
      </Card>
    );
  };

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>练习中心</Title>
      <Text type="secondary">
        基于 Python 编程的系统练习，通过做题自动更新学习画像
      </Text>

      {/* 总体进度 */}
      <Card style={{ marginTop: 16, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff' }}>
        <Row gutter={24} align="middle">
          <Col span={6}>
            <div>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>总体进度</Text>
              <div style={{ fontSize: 32, fontWeight: 'bold' }}>
                {completedCount} / {totalQuestions}
              </div>
              <Progress
                percent={totalQuestions > 0 ? Math.round((completedCount / totalQuestions) * 100) : 0}
                showInfo={false}
                strokeColor="#fff"
                trailColor="rgba(255,255,255,0.3)"
                style={{ marginTop: 4 }}
              />
            </div>
          </Col>
          <Col span={6}>
            <div>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>正确率</Text>
              <div style={{ fontSize: 32, fontWeight: 'bold' }}>
                {completedCount > 0 ? totalScore : 0}%
              </div>
              <Text style={{ color: 'rgba(255,255,255,0.7)' }}>
                已完成 {correctCount} / {completedCount} 题
              </Text>
            </div>
          </Col>
          <Col span={6}>
            <div>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>学习计划</Text>
              <div style={{ fontSize: 18, fontWeight: 'bold', marginTop: 4 }}>
                {learningPlan.name}
              </div>
              <Text style={{ color: 'rgba(255,255,255,0.7)' }}>
                共 {learningPlan.modules.length} 个模块
              </Text>
            </div>
          </Col>
          <Col span={6} style={{ textAlign: 'right' }}>
            <Button
              icon={<ReloadOutlined />}
              onClick={handleReset}
              style={{ background: 'rgba(255,255,255,0.2)', borderColor: 'rgba(255,255,255,0.3)', color: '#fff' }}
            >
              重置记录
            </Button>
          </Col>
        </Row>
      </Card>

      <Row gutter={24} style={{ marginTop: 16 }}>
        {/* 左侧：模块列表 */}
        <Col span={6}>
          <Card title="学习模块" bodyStyle={{ padding: 0 }}>
            <Collapse
              activeKey={[activeModuleId]}
              onChange={keys => {
                // Collapse onChange 传入合并后的所有 key，需找出新增的那个
                const newKey = (keys as string[]).find(k => k !== activeModuleId);
                if (newKey) {
                  setActiveModuleId(newKey);
                  setBatchIndex(0);
                }
              }}
              style={{ background: '#fff' }}
            >
              {learningPlan.modules.map((module, mIdx) => {
                const progress = moduleProgress.find(p => p.moduleId === module.id);
                const isActive = module.id === activeModuleId;

                return (
                  <Panel
                    key={module.id}
                    header={
                      <Space>
                        <Avatar
                          size="small"
                          style={{
                            background: progress && progress.score >= 80
                              ? '#52c41a'
                              : progress && progress.score >= 50
                              ? '#1890ff'
                              : '#d9d9d9',
                          }}
                        >
                          {mIdx + 1}
                        </Avatar>
                        <div>
                          <Text strong={isActive}>{module.name}</Text>
                          <br />
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            {module.questionCount} 题 · 已完成 {progress?.completedQuestions ?? 0} 题
                          </Text>
                        </div>
                      </Space>
                    }
                  >
                    <Space direction="vertical" style={{ width: '100%' }} size="middle">
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>模块得分</Text>
                          <Text strong style={{ fontSize: 12, color: progress && progress.score >= 80 ? '#52c41a' : '#000' }}>
                            {progress?.score ?? 0}%
                          </Text>
                        </div>
                        <Progress
                          percent={progress?.score ?? 0}
                          size="small"
                          showInfo={false}
                          strokeColor={progress && progress.score >= 80 ? '#52c41a' : '#1890ff'}
                        />
                      </div>
                      <Divider style={{ margin: '4px 0' }} />
                      <Button
                        type={isActive ? 'primary' : 'default'}
                        size="small"
                        block
                        icon={<RocketOutlined />}
                        onClick={() => {
                          setActiveModuleId(module.id);
                          setBatchIndex(0);
                        }}
                      >
                        {progress?.completedQuestions ?? 0 > 0 ? '继续练习' : '开始练习'}
                      </Button>
                    </Space>
                  </Panel>
                );
              })}
            </Collapse>
          </Card>
        </Col>

        {/* 右侧：做题区域 */}
        <Col span={18}>
          <Card
            title={learningPlan.modules.find(m => m.id === activeModuleId)?.name}
            extra={
              <Space>
                <Tag color="blue">第 {batchIndex + 1} / {totalBatches} 批</Tag>
                <Text type="secondary">
                  {currentBatchQuestions.length > 0 && (
                    <span>
                      {currentBatchQuestions.filter(q => !!getQuestionResult(q.id)?.isSubmitted).length}
                      / {currentBatchQuestions.length} 题已提交
                    </span>
                  )}
                </Text>
              </Space>
            }
          >
            <Progress
              percent={Math.round(((batchIndex + 1) / totalBatches) * 100)}
              showInfo={false}
              style={{ marginBottom: 16 }}
            />

            {/* 题目列表 */}
            {currentBatchQuestions.length > 0 ? (
              currentBatchQuestions.map((q, idx) => renderQuestion(q, batchIndex * BATCH_SIZE + idx + 1))
            ) : (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Text type="secondary">该模块暂无题目</Text>
              </div>
            )}

            {/* 批量提交按钮 + 导航 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
              <Button
                onClick={() => setBatchIndex(prev => Math.max(0, prev - 1))}
                disabled={batchIndex === 0 || isBatchSubmitting}
              >
                上一批
              </Button>

              <Space>
                {/* 批量提交按钮 */}
                <Button
                  type="primary"
                  onClick={handleBatchSubmit}
                  loading={isBatchSubmitting}
                  disabled={!currentBatchHasAnswer || currentBatchAllSubmitted || isBatchSubmitting}
                  style={currentBatchAllSubmitted ? { background: '#52c41a', borderColor: '#52c41a' } : {}}
                >
                  {currentBatchAllSubmitted
                    ? '本批次已完成'
                    : isBatchSubmitting
                    ? '提交中...'
                    : `批量提交 (${currentBatchQuestions.filter(q => !getQuestionResult(q.id)?.isSubmitted && !!answers[q.id]?.trim()).length})`}
                </Button>

                {/* 批次指示器 */}
                {Array.from({ length: totalBatches }).map((_, idx) => {
                  const batchQs = questions.filter(q => q.moduleId === activeModuleId).slice(idx * BATCH_SIZE, (idx + 1) * BATCH_SIZE);
                  const done = batchQs.every(q => !!getQuestionResult(q.id)?.isSubmitted);
                  return (
                    <Button
                      key={idx}
                      size="small"
                      type={idx === batchIndex ? 'primary' : 'default'}
                      disabled={idx === batchIndex || isBatchSubmitting}
                      onClick={() => setBatchIndex(idx)}
                      style={done ? { background: '#52c41a', borderColor: '#52c41a' } : {}}
                    >
                      {done ? <CheckCircleOutlined /> : idx + 1}
                    </Button>
                  );
                })}
              </Space>

              <Button
                onClick={() => setBatchIndex(prev => Math.min(totalBatches - 1, prev + 1))}
                disabled={batchIndex >= totalBatches - 1 || isBatchSubmitting}
              >
                下一批
              </Button>
            </div>

            {/* AI 批量判分中 */}
            {isAiGrading && !gradingQuestionId && (
              <Card
                size="small"
                style={{ marginTop: 16, background: '#f0f5ff', border: '1px solid #adc6ff' }}
              >
                <Space>
                  <Spin size="small" />
                  <Text>AI 正在逐题评分，请稍候...</Text>
                </Space>
              </Card>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Practice;
