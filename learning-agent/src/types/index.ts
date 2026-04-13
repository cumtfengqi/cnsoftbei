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
  resources: LearningResource[];
  status: 'pending' | 'in-progress' | 'completed';
  progress: number;
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
}

// 学习效果评估
export interface LearningAssessment {
  dimension: string;
  score: number;
  trend: 'up' | 'down' | 'stable';
  feedback: string;
}
