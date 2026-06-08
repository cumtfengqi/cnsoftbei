



import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Typography, Tag, Space, Button, Row, Col, Progress, Radio,
  Input, Spin, message, Avatar, Divider, Collapse, Modal, InputNumber,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  RocketOutlined,
  ReloadOutlined,
  BookOutlined,
  CalculatorOutlined,
  UserOutlined,
  TrophyOutlined,
  BarChartOutlined,
  UnlockOutlined,
  LockOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import type { PracticeQuestion, ModuleProgress, StudentProfile } from '../types';
import {
  learningPlan as pythonLearningPlan,
  questions as pythonQuestions,
  checkAnswer as pythonCheckAnswer,
  gradeByAI as pythonGradeByAI,
  submitAnswer as pythonSubmitAnswer,
  getOrCreatePracticeState as pythonGetState,
  resetPracticeState as pythonResetState,
  calculateDimensionWeightedScores as pythonCalcDimScores,
  ALL_DIMENSION_KEYS as pythonDimKeys,
} from '../services/practiceGrader';
import {
  learningPlan as mathLearningPlan,
  questions as mathQuestions,
  checkAnswer as mathCheckAnswer,
  gradeByAI as mathGradeByAI,
  submitAnswer as mathSubmitAnswer,
  getOrCreatePracticeState as mathGetState,
  resetPracticeState as mathResetState,
  calculateDimensionWeightedScores as mathCalcDimScores,
  ALL_DIMENSION_KEYS as mathDimKeys,
} from '../services/mathPracticeGrader';
import type { DimensionWeightedScore as PythonDimensionWeightedScore } from '../services/practiceGrader';
import type { DimensionWeightedScore as MathDimensionWeightedScore } from '../services/mathPracticeGrader';
import { usePageCache } from '../context/PageCacheContext';
import {
  loadThreshold,
  saveThreshold,
  checkThresholdMet,
  completeCurrentNodeAndUnlockNext,
  hasNextNode,
  getOrCreatePathState,
  getSubjectPracticeStats,
  getCurrentNodeSubjectId,
} from '../services/pathStateService';
import type { PathThreshold } from '../services/pathStateService';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Panel } = Collapse;

const PAGE_KEY = 'practice';
const BATCH_SIZE = 5;

type Subject = 'python' | 'math';

interface SubjectConfig {
  learningPlan: typeof pythonLearningPlan;
  questions: PracticeQuestion[];
  checkAnswer: (q: PracticeQuestion, answer: string) => boolean | null;
  gradeByAI: (q: PracticeQuestion, answer: string, onChunk?: (text: string) => void) => Promise<number>;
  submitAnswer: (questionId: string, userAnswer: string, isCorrect: boolean | null, aiScore?: number) => any;
  getOrCreatePracticeState: () => any;
  resetPracticeState: () => any;
  label: string;
  icon: React.ReactNode;
}

const subjectConfigs: Record<Subject, SubjectConfig> = {
  python: {
    learningPlan: pythonLearningPlan,
    questions: pythonQuestions,
    checkAnswer: pythonCheckAnswer,
    gradeByAI: pythonGradeByAI,
    submitAnswer: pythonSubmitAnswer,
    getOrCreatePracticeState: pythonGetState,
    resetPracticeState: pythonResetState,
    label: 'Python 编程',
    icon: <BookOutlined />,
  },
  math: {
    learningPlan: mathLearningPlan,
    questions: mathQuestions,
    checkAnswer: mathCheckAnswer,
    gradeByAI: mathGradeByAI,
    submitAnswer: mathSubmitAnswer,
    getOrCreatePracticeState: mathGetState,
    resetPracticeState: mathResetState,
    label: '数学应用题',
    icon: <CalculatorOutlined />,
  },
};

interface QuestionResult {
  questionId: string;
  userAnswer: string;
  isCorrect: boolean | null;
  aiScore?: number;
  isSubmitted: boolean;
}

const Practice: React.FC = () => {
  const { cachedState, saveState } = usePageCache(PAGE_KEY);

  const [subject, setSubject] = useState<Subject>(() =>
    cachedState?.subject ?? 'python'
  );

  const config = subjectConfigs[subject];

  const [activeModuleId, setActiveModuleId] = useState<string>(() =>
    cachedState?.activeModuleId ?? config.learningPlan.modules[0].id
  );

  const [batchIndex, setBatchIndex] = useState<number>(() => cachedState?.batchIndex ?? 0);

  const [results, setResults] = useState<Record<string, QuestionResult>>(() =>
    cachedState?.results ?? {}
  );

  const [answers, setAnswers] = useState<Record<string, string>>({});

    const [isBatchSubmitting, setIsBatchSubmitting] = useState(false);
  const [isAiGrading, setIsAiGrading] = useState(false);
  const [aiGradeText, setAiGradeText] = useState('');
  const [gradingQuestionId, setGradingQuestionId] = useState<string | null>(null);

  // ===== 学习路径解锁相关状态 =====
  const [threshold, setThreshold] = useState<PathThreshold>(() => loadThreshold());
  const [thresholdModalOpen, setThresholdModalOpen] = useState(false);
  const [editMinQuestions, setEditMinQuestions] = useState(threshold.minQuestions);
  const [editMinAccuracy, setEditMinAccuracy] = useState(threshold.minAccuracy);
  const [pathState, setPathState] = useState(() => getOrCreatePathState());
  const hasNext = hasNextNode();

    const [moduleProgress, setModuleProgress] = useState<ModuleProgress[]>(() => {
    const state = config.getOrCreatePracticeState();
    return state.moduleProgress;
  });

  // ===== 画像维度加权得分 =====
  const [dimensionScores, setDimensionScores] = useState<PythonDimensionWeightedScore[]>(() => {
    const state = config.getOrCreatePracticeState();
    if (state.results.length === 0) return [];
    const calcFn = subject === 'python' ? pythonCalcDimScores : mathCalcDimScores;
    return calcFn(state.results, config.questions);
  });

  // 每次提交后刷新维度评分
  useEffect(() => {
    const state = config.getOrCreatePracticeState();
    if (state.results.length > 0) {
      const calcFn = subject === 'python' ? pythonCalcDimScores : mathCalcDimScores;
      setDimensionScores(calcFn(state.results, config.questions));
    }
  }, [results, subject]);

  const switchSubject = (newSubject: Subject) => {
    if (newSubject === subject) return;
    setSubject(newSubject);
    const newConfig = subjectConfigs[newSubject];
    setActiveModuleId(newConfig.learningPlan.modules[0].id);
    setBatchIndex(0);
    setResults({});
    setAnswers({});
    setModuleProgress(newConfig.getOrCreatePracticeState().moduleProgress);
  };

  useEffect(() => {
    saveState({ subject, activeModuleId, batchIndex, results });
  }, [subject, activeModuleId, batchIndex, results, saveState]);

  const moduleQuestions = config.questions.filter(q => q.moduleId === activeModuleId);
  const totalBatches = Math.ceil(moduleQuestions.length / BATCH_SIZE);

  const currentBatchQuestions = moduleQuestions.slice(
    batchIndex * BATCH_SIZE,
    (batchIndex + 1) * BATCH_SIZE
  );

  const getQuestionResult = useCallback(
    (qId: string) => results[qId],
    [results]
  );

  const totalQuestions = config.questions.length;
  const completedCount = Object.keys(results).filter(id => results[id].isSubmitted).length;
  const correctCount = Object.values(results).filter(r => r.isSubmitted && r.isCorrect).length;
  const totalScore = totalQuestions > 0 ? Math.round((correctCount / completedCount) * 100) || 0 : 0;

  const currentBatchAllSubmitted = currentBatchQuestions.every(
    q => !!getQuestionResult(q.id)?.isSubmitted
  );

  const currentBatchHasAnswer = currentBatchQuestions.some(
    q => !getQuestionResult(q.id)?.isSubmitted && !!answers[q.id]?.trim()
  );

  const handleBatchSubmit = async () => {
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
      for (const q of toSubmit) {
        const selectedAnswer = answers[q.id] ?? '';

        if (q.type === 'short') {
          setGradingQuestionId(q.id);
          setAiGradeText('');

          const autoCorrect = config.checkAnswer(q, selectedAnswer);

          if (autoCorrect !== null) {
            newResults[q.id] = {
              questionId: q.id,
              userAnswer: selectedAnswer,
              isCorrect: autoCorrect,
              isSubmitted: true,
            };
            config.submitAnswer(q.id, selectedAnswer, autoCorrect);
          } else {
            try {
              const score = await config.gradeByAI(q, selectedAnswer, (text) => {
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
              config.submitAnswer(q.id, selectedAnswer, null, score);
            } catch {
              newResults[q.id] = {
                questionId: q.id,
                userAnswer: selectedAnswer,
                isCorrect: null,
                aiScore: 0,
                isSubmitted: true,
              };
            }
          }
        } else {
          const isCorrect = config.checkAnswer(q, selectedAnswer);
          newResults[q.id] = {
            questionId: q.id,
            userAnswer: selectedAnswer,
            isCorrect,
            isSubmitted: true,
          };
          config.submitAnswer(q.id, selectedAnswer, isCorrect);
        }

        setResults({ ...newResults });
        setModuleProgress(config.getOrCreatePracticeState().moduleProgress);
      }

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

        // ===== 路径解锁操作（科目标识感知） =====
  // 获取当前路径节点所需的科目标识
  const requiredSubjectId = getCurrentNodeSubjectId();
  // 根据科目标识获取对应科目的练习统计数据
  const subjectStats = getSubjectPracticeStats(requiredSubjectId);
  // 判断当前科目是否匹配路径需要的科目
  const isSubjectMatched = !requiredSubjectId || subject === requiredSubjectId;

  // 解锁条件检测：只认对应科目的数据
  const thresholdCheck = subjectStats.completedCount > 0
    ? checkThresholdMet(subjectStats.completedCount, subjectStats.correctRate, threshold)
    : { met: false, reason: `请先在「${subject === 'python' ? 'Python' : '数学'}」中完成答题` };

  const handleUnlockNext = () => {
    if (!isSubjectMatched) {
      Modal.info({
        title: '科目不匹配',
        content: (
          <div>
            <p>当前路径阶段要求使用 <Text strong>{requiredSubjectId === 'python' ? 'Python 编程' : '数学应用题'}</Text> 练习来解锁。</p>
            <p>请切换到正确的科目后再试。</p>
          </div>
        ),
        okText: '知道了',
      });
      return;
    }
    if (!thresholdCheck.met) {
      Modal.confirm({
        title: '解锁条件尚未满足',
        content: (
          <div>
            <p style={{ color: '#f5222d' }}>{thresholdCheck.reason}</p>
            <p>是否仍然强行解锁下一阶段？（跳过条件检查）</p>
          </div>
        ),
        okText: '强行解锁',
        cancelText: '再练练',
        onOk: () => doUnlockNext(),
      });
      return;
    }
    Modal.confirm({
      title: '确认完成当前阶段',
      content: (
        <div>
          <p>相关科目：<Text strong>{requiredSubjectId === 'python' ? 'Python 编程' : requiredSubjectId === 'math' ? '数学应用题' : '全部科目'}</Text></p>
          <p>当前答题 {subjectStats.completedCount} 题，正确率 {subjectStats.correctRate}%</p>
          <p style={{ color: '#52c41a' }}>{thresholdCheck.reason}</p>
          <p>确认后当前阶段将被标记为「已完成」，并解锁下一阶段。</p>
        </div>
      ),
      okText: '确认解锁下一章',
      cancelText: '取消',
      onOk: () => doUnlockNext(),
    });
  };

  const doUnlockNext = () => {
    const updated = completeCurrentNodeAndUnlockNext();
    if (updated) {
      setPathState(updated);
      // 通知 Path 页面刷新
      window.dispatchEvent(new CustomEvent('pathStateUpdated'));
      message.success(`🎉 已解锁下一阶段：「${updated.nodes.find(n => n.id === updated.currentNodeId)?.title}」`);
    } else {
      message.warning('已经是最后一个阶段，无需解锁');
    }
  };

  const handleOpenThresholdSettings = () => {
    setEditMinQuestions(threshold.minQuestions);
    setEditMinAccuracy(threshold.minAccuracy);
    setThresholdModalOpen(true);
  };

  const handleSaveThreshold = () => {
    const newThreshold: PathThreshold = {
      minQuestions: Math.max(1, editMinQuestions),
      minAccuracy: Math.max(10, Math.min(100, editMinAccuracy)),
    };
    setThreshold(newThreshold);
    saveThreshold(newThreshold);
    setThresholdModalOpen(false);
    message.success('解锁条件已更新');
  };

  const handleReset = () => {
    const state = config.resetPracticeState();
    setResults({});
    setModuleProgress(state.moduleProgress);
    setBatchIndex(0);
    setAnswers({});
    message.success('练习记录已重置');
  };

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

            {question.type === 'short' && question.sampleAnswer && (
              <div style={{ marginTop: 8 }}>
                <Text strong>参考答案：</Text>
                <Paragraph style={{ marginTop: 4, whiteSpace: 'pre-wrap', fontSize: 13, color: '#555' }}>
                  {question.sampleAnswer}
                </Paragraph>
              </div>
            )}

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

      {/* 科目切换 */}
      <Card size="small" style={{ marginBottom: 16, background: '#fafafa' }}>
        <Space>
          <Text strong style={{ fontSize: 14 }}>选择科目：</Text>
          <Button
            type={subject === 'python' ? 'primary' : 'default'}
            icon={<BookOutlined />}
            onClick={() => switchSubject('python')}
            style={subject === 'python' ? {} : { background: '#fff' }}
          >
            Python 编程
          </Button>
          <Button
            type={subject === 'math' ? 'primary' : 'default'}
            icon={<CalculatorOutlined />}
            onClick={() => switchSubject('math')}
            style={subject === 'math' ? {} : { background: '#fff' }}
          >
            数学应用题
          </Button>
        </Space>
      </Card>

      <Text type="secondary">
        {subject === 'python'
          ? '基于 Python 编程的系统练习，通过做题自动更新学习画像'
          : '小学数学应用题专项练习，涵盖分数比例、行程问题、工程经济等题型'}
      </Text>

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
                {config.learningPlan.name}
              </div>
              <Text style={{ color: 'rgba(255,255,255,0.7)' }}>
                共 {config.learningPlan.modules.length} 个模块
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
        <Col span={6}>
          <Card title="学习模块" bodyStyle={{ padding: 0 }}>
            <Collapse
              activeKey={[activeModuleId]}
              onChange={keys => {
                const newKey = (keys as string[]).find(k => k !== activeModuleId);
                if (newKey) {
                  setActiveModuleId(newKey);
                  setBatchIndex(0);
                }
              }}
              style={{ background: '#fff' }}
            >
              {config.learningPlan.modules.map((module, mIdx) => {
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

          {/* 画像维度加权得分可视化 */}
          {dimensionScores.length > 0 && (
            <Card
              title={
                <Space>
                  <BarChartOutlined />
                  <span>画像维度加权得分</span>
                </Space>
              }
              size="small"
              style={{ marginTop: 16 }}
            >
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
                基于每题预设的维度权重 × 答题得分综合计算
              </Text>
              <Space direction="vertical" style={{ width: '100%' }} size="small">
                {dimensionScores.map(ds => {
                  const scoreColor = ds.level === '高' ? '#52c41a' : ds.level === '中' ? '#1890ff' : '#faad14';
                  return (
                    <div key={ds.dimensionKey}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <Text style={{ fontSize: 12 }}>{ds.dimensionLabel}</Text>
                        <Space size={4}>
                          <Text strong style={{ fontSize: 12, color: scoreColor }}>{ds.weightedScore}%</Text>
                          <Tag color={scoreColor} style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>
                            {ds.level}
                          </Tag>
                        </Space>
                      </div>
                      <Progress
                        percent={ds.weightedScore}
                        size="small"
                        showInfo={false}
                        strokeColor={scoreColor}
                        trailColor="#f0f0f0"
                      />
                      <Text type="secondary" style={{ fontSize: 10 }}>
                        权重贡献: {ds.totalWeight.toFixed(1)} | 答题: {ds.answeredCount} 次
                      </Text>
                    </div>
                  );
                })}
              </Space>
            </Card>
          )}
        </Col>

        <Col span={18}>
          <Card
            title={config.learningPlan.modules.find(m => m.id === activeModuleId)?.name}
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

            {currentBatchQuestions.length > 0 ? (
              currentBatchQuestions.map((q, idx) => renderQuestion(q, batchIndex * BATCH_SIZE + idx + 1))
            ) : (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Text type="secondary">该模块暂无题目</Text>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
              <Button
                onClick={() => setBatchIndex(prev => Math.max(0, prev - 1))}
                disabled={batchIndex === 0 || isBatchSubmitting}
              >
                上一批
              </Button>

              <Space>
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

                {Array.from({ length: totalBatches }).map((_, idx) => {
                  const batchQs = config.questions.filter(q => q.moduleId === activeModuleId).slice(idx * BATCH_SIZE, (idx + 1) * BATCH_SIZE);
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

                                        {/* ===== 学习路径解锁区域（科目感知） ===== */}
          <Card
            style={{
              marginTop: 16,
              borderColor: thresholdCheck.met ? '#52c41a' : '#faad14',
              borderStyle: 'dashed',
            }}
            styles={{ body: { padding: '16px 24px' } }}
          >
            <Row gutter={16} align="middle">
              <Col flex="auto">
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                  <Space>
                    {thresholdCheck.met ? (
                      <UnlockOutlined style={{ color: '#52c41a', fontSize: 18 }} />
                    ) : (
                      <LockOutlined style={{ color: '#faad14', fontSize: 18 }} />
                    )}
                    <Text strong style={{ fontSize: 15 }}>
                      学习路径解锁
                    </Text>
                    <Tag color={thresholdCheck.met ? 'success' : 'warning'}>
                      {thresholdCheck.met ? '条件已达标' : '条件未满足'}
                    </Tag>
                    {requiredSubjectId && (
                      <Tag color="blue" style={{ fontSize: 11 }}>
                        需用「{requiredSubjectId === 'python' ? 'Python' : '数学'}」答题
                      </Tag>
                    )}
                  </Space>
                  <Space style={{ flexWrap: 'wrap' }}>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      解锁条件：答题 ≥ {threshold.minQuestions} 题 · 正确率 ≥ {threshold.minAccuracy}%
                    </Text>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      {requiredSubjectId
                        ? `当前（${requiredSubjectId === 'python' ? 'Python' : '数学'}）：${subjectStats.completedCount} 题 · ${subjectStats.correctRate}%`
                        : `当前（全部科目）：${subjectStats.completedCount} 题 · ${subjectStats.correctRate}%`}
                    </Text>
                  </Space>
                  {subjectStats.completedCount > 0 && (
                    <div style={{ width: 300 }}>
                      <Progress
                        percent={Math.min(100, Math.round((subjectStats.completedCount / threshold.minQuestions) * 100))}
                        size="small"
                        strokeColor={subjectStats.completedCount >= threshold.minQuestions ? '#52c41a' : '#faad14'}
                        format={() => `${subjectStats.completedCount}/${threshold.minQuestions} 题`}
                        style={{ marginBottom: 4 }}
                      />
                      <Progress
                        percent={Math.min(100, Math.round((subjectStats.correctRate / threshold.minAccuracy) * 100))}
                        size="small"
                        strokeColor={subjectStats.correctRate >= threshold.minAccuracy ? '#52c41a' : '#faad14'}
                        format={() => `${subjectStats.correctRate}%/${threshold.minAccuracy}%`}
                      />
                    </div>
                  )}
                  {!isSubjectMatched && (
                    <Text type="secondary" style={{ fontSize: 12, color: '#faad14' }}>
                      当前是「{subject === 'python' ? 'Python' : '数学'}」练习，该阶段需要「{requiredSubjectId === 'python' ? 'Python' : '数学'}」数据
                    </Text>
                  )}
                </Space>
              </Col>
              <Col>
                <Space direction="vertical" size={8}>
                  <Button
                    type="primary"
                    size="large"
                    icon={thresholdCheck.met ? <UnlockOutlined /> : <RocketOutlined />}
                    onClick={handleUnlockNext}
                    disabled={subjectStats.completedCount === 0}
                    style={{
                      background: thresholdCheck.met ? '#52c41a' : '#1890ff',
                      borderColor: thresholdCheck.met ? '#52c41a' : '#1890ff',
                      minWidth: 200,
                    }}
                  >
                    {hasNext ? '完成当前阶段并解锁下一章' : '已是最后阶段'}
                  </Button>
                  <Button
                    size="small"
                    icon={<SettingOutlined />}
                    onClick={handleOpenThresholdSettings}
                    block
                  >
                    自定义解锁条件
                  </Button>
                </Space>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {/* 解锁条件设置弹窗 */}
      <Modal
        title="自定义解锁条件"
        open={thresholdModalOpen}
        onOk={handleSaveThreshold}
        onCancel={() => setThresholdModalOpen(false)}
        okText="保存条件"
        cancelText="取消"
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <Text strong>最少答题数量</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              达到此数量后方可解锁下一阶段
            </Text>
            <InputNumber
              min={1}
              max={100}
              value={editMinQuestions}
              onChange={v => setEditMinQuestions(v ?? 5)}
              style={{ width: '100%', marginTop: 4 }}
              addonAfter="题"
            />
          </div>
          <div>
            <Text strong>最低正确率</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              答题正确率达到此百分比后方可解锁
            </Text>
            <InputNumber
              min={10}
              max={100}
              value={editMinAccuracy}
              onChange={v => setEditMinAccuracy(v ?? 60)}
              style={{ width: '100%', marginTop: 4 }}
              addonAfter="%"
            />
          </div>
        </Space>
      </Modal>
    </div>
  );
};

export default Practice;
