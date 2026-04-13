/**
 * 多智能体协同框架
 * 实现不同角色智能体的协作与通信
 */

import { chatCompletion, type ChatMessage } from './api';
import type { ResourceType, StudentProfile } from '../types';

// 智能体角色定义
export type AgentRole =
  | 'profile'      // 画像构建智能体
  | 'resource'     // 资源生成智能体
  | 'path'         // 路径规划智能体
  | 'tutor'        // 辅导答疑智能体
  | 'assessment';  // 效果评估智能体

// 智能体状态
export type AgentStatus = 'idle' | 'thinking' | 'speaking' | 'completed' | 'error';

// 智能体消息
export interface AgentMessage {
  id: string;
  agentId: string;
  agentRole: AgentRole;
  content: string;
  timestamp: number;
}

// 智能体任务
export interface AgentTask {
  id: string;
  type: string;
  input: any;
  output?: any;
  status: 'pending' | 'running' | 'completed' | 'failed';
  assignedAgent?: AgentRole;
  result?: any;
  error?: string;
}

// 智能体定义
export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  description: string;
  systemPrompt: string;
  status: AgentStatus;
  lastMessage?: string;
  lastMessageTime?: number;
}

// 事件类型
export type AgentEventType =
  | 'task_assigned'
  | 'task_started'
  | 'task_completed'
  | 'task_failed'
  | 'message_received'
  | 'status_changed';

// 事件监听器
type EventListener = (data: any) => void;

// ==================== 智能体定义 ====================

const AGENT_DEFINITIONS: Record<AgentRole, Omit<Agent, 'status' | 'lastMessage' | 'lastMessageTime'>> = {
  profile: {
    id: 'agent-profile',
    name: '画像构建智能体',
    role: 'profile',
    description: '通过对话分析学生学习特征，构建个性化画像',
    systemPrompt: `你是画像构建智能体，专门分析学生的学习特征。你的任务是：
1. 通过与学生的对话，提取关键信息（专业、课程、学习目标、知识弱点等）
2. 分析学生的认知风格、学习习惯
3. 构建包含6个维度的学生画像：知识基础、认知风格、易错点偏好、学习节奏、兴趣方向、学习习惯
4. 用JSON格式输出画像分析结果

每次回复要简洁、专业，像一个教育AI助手。`,
  },

  resource: {
    id: 'agent-resource',
    name: '资源生成智能体',
    role: 'resource',
    description: '依据学习需求生成多模态学习资源',
    systemPrompt: `你是资源生成智能体，专门为学生生成个性化学习资源。根据用户需求，你可以生成以下类型的资源：
1. document - 专业课程讲解文档
2. mindmap - 知识点思维导图（用Markdown格式展示结构）
3. quiz - 练习题目（包含选择题、填空题、编程题）
4. reading - 拓展阅读材料
5. video - 教学视频/动画脚本
6. codeCase - 代码类实操案例

请根据学习主题和资源类型，生成高质量、有实际价值的学习内容。`,
  },

  path: {
    id: 'agent-path',
    name: '路径规划智能体',
    role: 'path',
    description: '分析学习情况，规划个性化学习路径',
    systemPrompt: `你是路径规划智能体，专门为学生制定个性化学习路径。你的任务是：
1. 分析学生当前的知识水平
2. 根据学习目标，规划合理的知识点顺序
3. 考虑知识点的依赖关系（前置知识必须先学）
4. 估算每个阶段的学习时间
5. 输出结构化的学习路径

用清晰的步骤展示，体现循序渐进的学习过程。`,
  },

  tutor: {
    id: 'agent-tutor',
    name: '智能辅导智能体',
    role: 'tutor',
    description: '即时答疑，提供多模态解答服务',
    systemPrompt: `你是智能辅导智能体，专门为学生答疑解惑。你的特点是：
1. 回答准确、专业、易懂
2. 擅长用图解、代码示例等多种方式解释复杂概念
3. 可以提供文字解答、图解说明、代码演示等多种形式
4. 引导式教学，帮助学生自己找到答案
5. 如果问题超出范围，诚实告知并尽量提供相关建议

请用最合适的方式解答学生的问题。`,
  },

  assessment: {
    id: 'agent-assessment',
    name: '效果评估智能体',
    role: 'assessment',
    description: '跟踪学习效果，提供多维度评估',
    systemPrompt: `你是效果评估智能体，专门评估学生的学习效果。你的任务是：
1. 分析学生的学习行为数据
2. 评估学生对知识点的掌握程度
3. 识别学生的薄弱环节
4. 提供改进建议
5. 输出多维度的评估报告

用数据说话，给出具体、可执行的建议。`,
  },
};

// ==================== 多智能体调度器 ====================

class MultiAgentScheduler {
  private agents: Map<AgentRole, Agent> = new Map();
  private taskQueue: AgentTask[] = [];
  private eventListeners: Map<AgentEventType, EventListener[]> = new Map();
  private messageHistory: AgentMessage[] = [];
  private currentProfile: StudentProfile | null = null;

  constructor() {
    // 初始化所有智能体
    Object.values(AGENT_DEFINITIONS).forEach(def => {
      this.agents.set(def.role, {
        ...def,
        status: 'idle',
      });
    });
  }

  // 事件管理
  on(event: AgentEventType, listener: EventListener) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  private emit(event: AgentEventType, data: any) {
    const listeners = this.eventListeners.get(event) || [];
    listeners.forEach(listener => listener(data));
  }

  // 获取智能体状态
  getAgent(role: AgentRole): Agent | undefined {
    return this.agents.get(role);
  }

  // 获取所有智能体状态
  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  // 更新学生画像
  setProfile(profile: StudentProfile) {
    this.currentProfile = profile;
  }

  // 获取画像
  getProfile(): StudentProfile | null {
    return this.currentProfile;
  }

  // 添加消息到历史
  addMessage(message: AgentMessage) {
    this.messageHistory.push(message);
  }

  // 获取消息历史
  getMessageHistory(): AgentMessage[] {
    return this.messageHistory;
  }

  // 创建任务
  createTask(type: string, input: any, assignedAgent?: AgentRole): AgentTask {
    const task: AgentTask = {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      input,
      status: 'pending',
      assignedAgent,
    };
    this.taskQueue.push(task);
    this.emit('task_assigned', task);
    return task;
  }

  // 执行单智能体任务
  async executeTask(task: AgentTask): Promise<any> {
    const agentRole = task.assignedAgent || this.inferAgentRole(task.type);
    const agent = this.agents.get(agentRole);

    if (!agent) {
      throw new Error(`Unknown agent role: ${agentRole}`);
    }

    // 更新智能体状态
    agent.status = 'thinking';
    this.emit('status_changed', { role: agentRole, status: 'thinking' });

    try {
      task.status = 'running';
      this.emit('task_started', task);

      const messages: ChatMessage[] = [
        { role: 'system', content: agent.systemPrompt },
      ];

      // 添加上下文
      if (this.currentProfile && agentRole !== 'profile') {
        messages.push({
          role: 'system',
          content: `当前学生画像：${JSON.stringify(this.currentProfile, null, 2)}`,
        });
      }

      // 添加任务输入
      if (typeof task.input === 'string') {
        messages.push({ role: 'user', content: task.input });
      } else {
        messages.push({ role: 'user', content: JSON.stringify(task.input, null, 2) });
      }

      // 调用大模型
      const response = await chatCompletion(messages);

      // 更新智能体状态
      agent.status = 'speaking';
      agent.lastMessage = response;
      agent.lastMessageTime = Date.now();
      this.emit('status_changed', { role: agentRole, status: 'speaking' });

      // 记录消息
      this.addMessage({
        id: `msg-${Date.now()}`,
        agentId: agent.id,
        agentRole,
        content: response,
        timestamp: Date.now(),
      });

      task.status = 'completed';
      task.result = response;
      task.output = response;

      agent.status = 'completed';
      this.emit('status_changed', { role: agentRole, status: 'completed' });
      this.emit('task_completed', task);

      return response;
    } catch (error: any) {
      task.status = 'failed';
      task.error = error.message;
      agent.status = 'error';
      this.emit('status_changed', { role: agentRole, status: 'error' });
      this.emit('task_failed', { task, error: error.message });
      throw error;
    }
  }

  // 推断智能体角色
  private inferAgentRole(type: string): AgentRole {
    if (type.includes('profile') || type.includes('画像')) return 'profile';
    if (type.includes('resource') || type.includes('生成') || type.includes('资源')) return 'resource';
    if (type.includes('path') || type.includes('路径') || type.includes('规划')) return 'path';
    if (type.includes('tutor') || type.includes('辅导') || type.includes('答疑')) return 'tutor';
    if (type.includes('assessment') || type.includes('评估') || type.includes('效果')) return 'assessment';
    return 'resource';
  }

  // 多智能体协作任务
  async executeCollaborativeTask(
    taskType: string,
    input: any,
    requiredAgents: AgentRole[]
  ): Promise<Record<AgentRole, string>> {
    const results: Record<AgentRole, string> = {} as Record<AgentRole, string>;

    // 依次执行每个智能体任务，上一个智能体的输出可能作为下一个的输入
    for (const role of requiredAgents) {
      const agent = this.agents.get(role);
      if (!agent) continue;

      // 为下一个智能体准备输入（可以包含前一个智能体的结果）
      let taskInput = input;
      if (results[requiredAgents[requiredAgents.indexOf(role) - 1]]) {
        const prevResult = results[requiredAgents[requiredAgents.indexOf(role) - 1]];
        taskInput = {
          originalInput: input,
          previousResult: prevResult,
        };
      }

      const task = this.createTask(taskType, taskInput, role);
      const result = await this.executeTask(task);
      results[role] = result;

      // 模拟协作延迟
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return results;
  }
}

// 单例导出
export const multiAgentScheduler = new MultiAgentScheduler();

// ==================== 资源生成服务 ====================

export class ResourceGenerator {
  private scheduler: MultiAgentScheduler;

  constructor(scheduler: MultiAgentScheduler) {
    this.scheduler = scheduler;
  }

  // 生成单一资源
  async generateResource(
    type: ResourceType,
    topic: string,
    onProgress?: (step: string, progress: number) => void
  ): Promise<string> {
    const typeLabels: Record<ResourceType, string> = {
      document: '专业课程讲解文档',
      mindmap: '知识点思维导图',
      quiz: '练习题目',
      reading: '拓展阅读材料',
      video: '多模态教学视频/动画',
      codeCase: '代码类实操案例',
    };

    const prompts: Record<ResourceType, string> = {
      document: `请为"${topic}"生成一份详细的专业课程讲解文档，要求：
1. 结构清晰，包含引言、核心内容、总结
2. 适合大学生学习水平
3. 包含必要的示例和解释
4. 不少于800字`,

      mindmap: `请为"${topic}"生成一份知识点思维导图，要求：
1. 用Markdown格式展示层级结构
2. 包含主节点和分支节点
3. 逻辑清晰，层次分明
4. 覆盖核心知识点`,

      quiz: `请为"${topic}"生成一套练习题目，要求：
1. 包含3道选择题、2道填空题、1道编程题
2. 题目难度适中，符合大学课程水平
3. 编程题需要包含题目描述和参考解答
4. 答案放在最后`,

      reading: `请为"${topic}"生成一份拓展阅读材料，要求：
1. 介绍相关领域的最新发展或经典理论
2. 包含3-5篇参考文献/资料推荐
3. 适合想要深入学习的学生
4. 简明扼要，重点突出`,

      video: `请为"${topic}"生成一份教学视频脚本/动画分镜，要求：
1. 时长约3-5分钟
2. 包含开场、讲解、总结三个部分
3. 设计可视化元素和动画效果说明
4. 适合视觉学习者`,

      codeCase: `请为"${topic}"生成一份代码实操案例，要求：
1. 包含完整的可运行代码
2. 代码需要详细注释
3. 包含运行结果示例
4. 适合实践学习者
5. 标注使用的编程语言和版本`,
    };

    onProgress?.(`正在调用${typeLabels[type]}生成智能体...`, 20);

    const task = this.scheduler.createTask(
      `generate_${type}`,
      prompts[type],
      'resource'
    );

    const result = await this.scheduler.executeTask(task);

    onProgress?.(`${typeLabels[type]}生成完成`, 100);

    return result;
  }

  // 批量生成资源（多智能体协作）
  async generateResources(
    types: ResourceType[],
    topic: string,
    onProgress?: (type: ResourceType, step: string, progress: number) => void
  ): Promise<Record<ResourceType, string>> {
    const results: Record<ResourceType, string> = {} as Record<ResourceType, string>;
    const total = types.length;

    for (let i = 0; i < types.length; i++) {
      const type = types[i];
      const baseProgress = (i / total) * 100;

      onProgress?.(type, `开始生成${type}...`, baseProgress);

      results[type] = await this.generateResource(type, topic, (step, p) => {
        onProgress?.(type, step, baseProgress + (p / 100) * (100 / total));
      });

      // 多智能体协作间隔
      if (i < types.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    return results;
  }
}

// 导出便捷函数
export const resourceGenerator = new ResourceGenerator(multiAgentScheduler);
