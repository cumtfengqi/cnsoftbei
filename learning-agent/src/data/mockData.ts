import type { Agent, StudentProfile, LearningResource, LearningPath, LearningAssessment } from '../types';

// 多智能体角色定义
export const agents: Agent[] = [
  {
    id: 'agent-profile',
    name: '画像构建智能体',
    role: 'Profile Agent',
    description: '通过对话分析学生学习特征，构建个性化画像',
    icon: 'UserOutlined',
    color: '#1890ff',
  },
  {
    id: 'agent-resource',
    name: '资源生成智能体',
    role: 'Resource Agent',
    description: '依据学习需求生成多模态学习资源',
    icon: 'FileTextOutlined',
    color: '#52c41a',
  },
  {
    id: 'agent-path',
    name: '路径规划智能体',
    role: 'Path Planner Agent',
    description: '分析学习情况，规划个性化学习路径',
    icon: 'AimOutlined',
    color: '#faad14',
  },
  {
    id: 'agent-tutor',
    name: '智能辅导智能体',
    role: 'Tutor Agent',
    description: '即时答疑，提供多模态解答服务',
    icon: 'QuestionCircleOutlined',
    color: '#722ed1',
  },
  {
    id: 'agent-assessment',
    name: '效果评估智能体',
    role: 'Assessment Agent',
    description: '跟踪学习效果，提供多维度评估',
    icon: 'DashboardOutlined',
    color: '#eb2f96',
  },
];

// 初始学生画像（6维度）
export const initialProfile: StudentProfile = {
  id: 'student-001',
  name: '张三',
  major: '计算机科学与技术',
  grade: '大三',
  updatedAt: new Date().toISOString(),
  dimensions: [
    { key: 'knowledgeBase', label: '知识基础', value: 'Python基础扎实，面向对象编程薄弱', level: '中' },
    { key: 'cognitiveStyle', label: '认知风格', value: '视觉型学习者，喜欢图文结合', level: '高' },
    { key: 'errorProne', label: '易错点偏好', value: '递归算法、多线程并发编程', level: '低' },
    { key: 'learningPace', label: '学习节奏', value: '接受较快，需要足够练习时间', level: '高' },
    { key: 'interestDirection', label: '兴趣方向', value: '人工智能、机器学习', level: '高' },
    { key: 'studyHabit', label: '学习习惯', value: '喜欢边做边学，实践驱动', level: '中' },
  ],
};

// 模拟生成的资源
export const mockResources: LearningResource[] = [
  {
    id: 'res-001',
    type: 'document',
    title: '机器学习基础概念详解',
    description: '涵盖监督学习、无监督学习、深度学习核心概念',
    generatedBy: '资源生成智能体',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'res-002',
    type: 'mindmap',
    title: '神经网络知识点思维导图',
    description: '从神经元到深度神经网络的完整知识体系',
    generatedBy: '资源生成智能体',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'res-003',
    type: 'quiz',
    title: 'Python面向对象编程练习题',
    description: '包含类、继承、多态等核心概念的练习题目',
    generatedBy: '资源生成智能体',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'res-004',
    type: 'reading',
    title: '深度学习经典论文导读',
    description: '精选10篇必读论文，附中文精读笔记',
    generatedBy: '资源生成智能体',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'res-005',
    type: 'video',
    title: '神经网络动画演示',
    description: '可视化展示前向传播与反向传播过程',
    generatedBy: '资源生成智能体',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'res-006',
    type: 'codeCase',
    title: 'PyTorch实战：手写数字识别',
    description: '完整项目代码，注释详尽，适合初学者',
    generatedBy: '资源生成智能体',
    createdAt: new Date().toISOString(),
  },
];

// 模拟学习路径
export const mockLearningPath: LearningPath = {
  id: 'path-001',
  title: '人工智能专业学习路径',
  description: '基于您的学习画像定制，为期8周的进阶学习计划',
  estimatedTime: '8周',
  currentNodeId: 'node-002',
  nodes: [
    {
      id: 'node-001',
      title: 'Python高级编程',
      description: '掌握装饰器、生成器、上下文管理器',
      resources: [mockResources[0], mockResources[2]],
      status: 'completed',
      progress: 100,
    },
    {
      id: 'node-002',
      title: '机器学习基础',
      description: '理解监督学习、无监督学习核心算法',
      resources: [mockResources[0], mockResources[1], mockResources[3]],
      status: 'in-progress',
      progress: 60,
    },
    {
      id: 'node-003',
      title: '深度学习入门',
      description: '神经网络原理、激活函数、损失函数',
      resources: [mockResources[1], mockResources[4]],
      status: 'pending',
      progress: 0,
    },
    {
      id: 'node-004',
      title: '神经网络实战',
      description: 'PyTorch/TensorFlow实战项目',
      resources: [mockResources[5]],
      status: 'pending',
      progress: 0,
    },
  ],
};

// 模拟学习效果评估
export const mockAssessments: LearningAssessment[] = [
  { dimension: '知识掌握度', score: 78, trend: 'up', feedback: '相比上周提升12%，需加强实践' },
  { dimension: '学习效率', score: 85, trend: 'stable', feedback: '效率稳定，继续保持' },
  { dimension: '问题解决能力', score: 72, trend: 'up', feedback: '代码调试能力显著提升' },
  { dimension: '知识点覆盖率', score: 65, trend: 'up', feedback: '新增2个知识模块，需继续拓展' },
];
