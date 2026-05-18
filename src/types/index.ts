// 学习画像维度
export interface StudentProfile {
  id: string;
  name: string;
  major: string;
  grade: string;
  dimensions: ProfileDimension[];
  updatedAt: string;
}

export interface ProfileDimension {
  key: string;
  label: string;
  value: string;
  level: '高' | '中' | '低';
}

// 智能体角色
export interface Agent {
  id: string;
  name: string;
  role: string;
  description: string;
  icon: string;
  color: string;
}

// 学习资源类型
export type ResourceType =
  | 'document'      // 专业课程讲解文档
  | 'mindmap'       // 知识点思维导图
  | 'quiz'          // 练习题目
  | 'reading'       // 拓展阅读材料
  | 'video'         // 多模态教学视频/动画
  | 'codeCase';     // 代码类实操案例

export interface LearningResource {
  id: string;
  type: ResourceType;
  title: string;
  description: string;
  generatedBy: string;
  createdAt: string;
  content?: string;
  thumbnail?: string;
}

// 学习路径节点
export interface LearningNode {
  id: string;
  title: string;
  description: string;
  resources?: LearningResource[];
  status: 'pending' | 'in-progress' | 'completed';
  progress: number;
  estimatedHours?: number;
}

// 学习路径
export interface LearningPath {
  id: string;
  title: string;
  description: string;
  nodes: LearningNode[];
  estimatedTime: string;
  currentNodeId: string;
}

// 聊天消息
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

// 问答记录
export interface QAItem {
  id: string;
  question: string;
  answer: string;
  type: 'text' | 'image' | 'video' | 'code';
  helpful: boolean;
  createdAt: string;
  parentId?: string;       // 追问所属的父问题 ID
  followUpIds?: string[];  // 该回答下的追问 ID 列表
}

// 学习效果评估
export interface LearningAssessment {
  dimension: string;
  score: number;
  trend: 'up' | 'down' | 'stable';
  feedback: string;
}

// ============ 练习中心 ============

export type QuestionType = 'choice' | 'truefalse' | 'short';
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface PracticeQuestion {
  id: string;
  moduleId: string;
  type: QuestionType;
  difficulty: Difficulty;
  tags: string[];
  question: string;
  options?: string[];           // 选择题选项
  correctAnswer?: string;        // 选择题正确答案索引/内容
  trueFalseAnswer?: boolean;     // 判断题答案
  sampleAnswer?: string;          // 简答题参考答案
  explanation?: string;           // 解析
}

export interface LearningModule {
  id: string;
  name: string;
  description: string;
  questionCount: number;
  tags: string[];
}

export interface LearningPlan {
  id: string;
  name: string;
  description: string;
  modules: LearningModule[];
}

export interface PracticeResult {
  questionId: string;
  moduleId: string;
  userAnswer: string;
  isCorrect: boolean | null;
  aiScore?: number;
  submittedAt: string;
}

export interface ModuleProgress {
  moduleId: string;
  moduleName: string;
  totalQuestions: number;
  completedQuestions: number;
  correctCount: number;
  shortAnswerCount: number;
  shortAnswerGradedCount: number;
  shortAnswerTotalScore: number;
  score: number;
}

export interface TagScore {
  tag: string;
  totalAnswered: number;
  correctCount: number;
  score: number;
}

export interface PracticeState {
  planId: string;
  results: PracticeResult[];
  moduleProgress: ModuleProgress[];
  tagScores: TagScore[];
  updatedAt: string;
}
