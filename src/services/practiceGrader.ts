import { streamChatCompletion } from './api';
import type {
  PracticeQuestion,
  PracticeResult,
  ModuleProgress,
  TagScore,
  PracticeState,
} from '../types';
import questionBank from '../data/practiceQuestionBank.json';
import { initialProfile } from '../data/mockData';

// ==================== Tag → 画像维度映射 ====================
const TAG_TO_DIMENSION: Record<string, string> = {
  // 知识基础
  syntax: 'knowledgeBase',
  'data-types': 'knowledgeBase',
  operators: 'knowledgeBase',
  'control-flow': 'knowledgeBase',
  functions: 'knowledgeBase',
  modules: 'knowledgeBase',
  scope: 'knowledgeBase',
  OOP: 'knowledgeBase',
  classes: 'knowledgeBase',
  inheritance: 'knowledgeBase',
  polymorphism: 'knowledgeBase',
  exceptions: 'knowledgeBase',
  files: 'knowledgeBase',
  decorators: 'knowledgeBase',
  comprehensions: 'knowledgeBase',
  // 易错点
  errorProne: 'errorProne',
  // 学习习惯
  studyHabit: 'studyHabit',
};

// ==================== 存储键名 ====================
const PRACTICE_STATE_KEY = 'practiceState';

export const learningPlan = questionBank.learningPlan;
export const questions = questionBank.questions as PracticeQuestion[];

// ==================== 客观题判分 ====================
export function checkAnswer(question: PracticeQuestion, userAnswer: string): boolean {
  if (question.type === 'choice') {
    return userAnswer === question.correctAnswer;
  }
  if (question.type === 'truefalse') {
    const expected = question.trueFalseAnswer ? 'true' : 'false';
    return userAnswer === expected;
  }
  return false;
}

// ==================== AI 判分（简答题） ====================
export async function gradeByAI(
  question: PracticeQuestion,
  userAnswer: string,
  onChunk?: (text: string) => void
): Promise<number> {
  if (question.type === 'short') {
    const messages = [
      {
        role: 'system' as const,
        content: `你是一个严谨的编程教育评估专家。请根据参考答案为用户的答案评分（0-100分）。
评分标准：
- 90-100：正确理解题意，答案完整准确，有深度
- 70-89：基本正确，有少量遗漏或小错误
- 50-69：理解部分题意，答案有较多不完整或错误
- 20-49：理解基本错误，答案偏离题意
- 0-19：完全错误或未作答

请严格按此标准评分，不要随意给高分。`,
      },
      {
        role: 'user' as const,
        content: `题目：${question.question}

参考答案：${question.sampleAnswer}

用户答案：${userAnswer}

请只输出一个0-100的整数分数，不要输出其他内容。`,
      },
    ];

    let fullResponse = '';
    await streamChatCompletion(
      messages,
      (chunk, isThinking) => {
        if (!isThinking) {
          fullResponse += chunk;
          onChunk?.(chunk);
        }
      },
    );

    // 提取数字分数
    const scoreMatch = fullResponse.match(/\d+/);
    if (scoreMatch) {
      return Math.min(100, Math.max(0, parseInt(scoreMatch[0], 10)));
    }
    return 0;
  }
  return 0;
}

// ==================== 计算模块进度 ====================
export function calculateModuleProgress(
  moduleId: string,
  results: PracticeResult[],
  allQuestions: PracticeQuestion[]
): ModuleProgress {
  const moduleQuestions = allQuestions.filter(q => q.moduleId === moduleId);
  const moduleResults = results.filter(r => r.moduleId === moduleId);

  const totalQuestions = moduleQuestions.length;
  const completedQuestions = moduleResults.length;

  // 客观题判分
  const objectiveResults = moduleResults.filter(r => r.isCorrect !== null);
  const correctCount = objectiveResults.filter(r => r.isCorrect).length;

  // 简答题统计
  const shortResults = moduleResults.filter(r => {
    const q = allQuestions.find(q => q.id === r.questionId);
    return q?.type === 'short';
  });
  const shortAnswerTotalScore = shortResults.reduce((sum, r) => sum + (r.aiScore || 0), 0);

  // 计算总分：客观题每题 50%权重，简答题每题 50%权重
  const objectiveScore = totalQuestions > 0
    ? (correctCount / moduleQuestions.filter(q => q.type !== 'short').length) * 50
    : 0;
  const shortScore = totalQuestions > 0
    ? (shortAnswerTotalScore / 100) * 50
    : 0;

  const score = Math.round(objectiveScore + shortScore);

  return {
    moduleId,
    moduleName: learningPlan.modules.find(m => m.id === moduleId)?.name || moduleId,
    totalQuestions,
    completedQuestions,
    correctCount,
    shortAnswerCount: shortResults.length,
    shortAnswerGradedCount: shortResults.filter(r => r.aiScore !== undefined).length,
    shortAnswerTotalScore,
    score,
  };
}

// ==================== 计算 Tag 维度得分 ====================
export function calculateTagScores(
  results: PracticeResult[],
  allQuestions: PracticeQuestion[]
): TagScore[] {
  const tagMap = new Map<string, { total: number; correct: number }>();

  for (const result of results) {
    if (result.isCorrect === null) continue; // 简答题不参与 Tag 计分（AI判分后可参与）
    const question = allQuestions.find(q => q.id === result.questionId);
    if (!question) continue;

    for (const tag of question.tags) {
      if (!tagMap.has(tag)) tagMap.set(tag, { total: 0, correct: 0 });
      const entry = tagMap.get(tag)!;
      entry.total++;
      if (result.isCorrect) entry.correct++;
    }
  }

  return Array.from(tagMap.entries()).map(([tag, data]) => ({
    tag,
    totalAnswered: data.total,
    correctCount: data.correct,
    score: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
  }));
}

// ==================== 更新画像 ====================
export function updateProfileByTagScores(tagScores: TagScore[]) {
  if (tagScores.length === 0) return;

  const savedProfile = localStorage.getItem('studentProfile');
  let profile = savedProfile ? JSON.parse(savedProfile) : { ...initialProfile };

  // 按 Tag 维度分组
  const dimensionScores: Record<string, { scores: number[]; count: number }> = {};

  for (const ts of tagScores) {
    const dimension = TAG_TO_DIMENSION[ts.tag] || ts.tag;
    if (!dimensionScores[dimension]) dimensionScores[dimension] = { scores: [], count: 0 };
    if (ts.totalAnswered > 0) {
      dimensionScores[dimension].scores.push(ts.score);
      dimensionScores[dimension].count++;
    }
  }

  // 计算每个画像维度的综合得分并更新
  const dimensionKeys = [
    'knowledgeBase', 'cognitiveStyle', 'errorProne',
    'learningPace', 'interestDirection', 'studyHabit',
  ];

  dimensionKeys.forEach(dimKey => {
    const entry = dimensionScores[dimKey];
    const dimIndex = profile.dimensions.findIndex((d: { key: string }) => d.key === dimKey);
    if (!entry || dimIndex === -1) return;

    const avgScore = entry.scores.reduce((a, b) => a + b, 0) / entry.scores.length;

    let level: '高' | '中' | '低' = '中';
    if (avgScore >= 80) level = '高';
    else if (avgScore < 50) level = '低';

    profile.dimensions[dimIndex] = {
      ...profile.dimensions[dimIndex],
      level,
      value: `通过练习测评，综合得分 ${Math.round(avgScore)}%，${level === '高' ? '掌握扎实' : level === '中' ? '有一定基础，需继续加强' : '基础薄弱，建议重点复习'}`,
    };
  });

  profile.updatedAt = new Date().toISOString();
  localStorage.setItem('studentProfile', JSON.stringify(profile));
  return profile;
}

// ==================== 持久化练习状态 ====================
export function loadPracticeState(): PracticeState | null {
  const saved = localStorage.getItem(PRACTICE_STATE_KEY);
  if (!saved) return null;
  try {
    return JSON.parse(saved);
  } catch {
    return null;
  }
}

export function savePracticeState(state: PracticeState): void {
  state.updatedAt = new Date().toISOString();
  localStorage.setItem(PRACTICE_STATE_KEY, JSON.stringify(state));
}

export function getOrCreatePracticeState(): PracticeState {
  const existing = loadPracticeState();
  if (existing) return existing;

  const state: PracticeState = {
    planId: learningPlan.id,
    results: [],
    moduleProgress: learningPlan.modules.map(m => calculateModuleProgress(m.id, [], questions)),
    tagScores: [],
    updatedAt: new Date().toISOString(),
  };
  savePracticeState(state);
  return state;
}

// ==================== 提交答题结果 ====================
export function submitAnswer(
  questionId: string,
  userAnswer: string,
  isCorrect: boolean | null,
  aiScore?: number
): PracticeState {
  const state = getOrCreatePracticeState();

  // 更新或添加结果
  const existingIdx = state.results.findIndex(r => r.questionId === questionId);
  const result: PracticeResult = {
    questionId,
    moduleId: questions.find(q => q.id === questionId)?.moduleId || '',
    userAnswer,
    isCorrect,
    aiScore,
    submittedAt: new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    state.results[existingIdx] = result;
  } else {
    state.results.push(result);
  }

  // 重新计算模块进度
  state.moduleProgress = learningPlan.modules.map(m => calculateModuleProgress(m.id, state.results, questions));

  // 重新计算 Tag 得分
  state.tagScores = calculateTagScores(state.results, questions);

  savePracticeState(state);
  // 通知其他页面（如 Assessment）刷新
  window.dispatchEvent(new CustomEvent('practiceStateUpdated'));
  return state;
}

// ==================== 重置练习状态 ====================
export function resetPracticeState(): PracticeState {
  const state: PracticeState = {
    planId: learningPlan.id,
    results: [],
    moduleProgress: learningPlan.modules.map(m => calculateModuleProgress(m.id, [], questions)),
    tagScores: [],
    updatedAt: new Date().toISOString(),
  };
  savePracticeState(state);
  return state;
}
