/**
 * 学习路径状态管理服务
 * 负责在 Practice 页面和 Path 页面之间共享路径节点状态
 * 支持用户自主设置解锁条件（最少答题数、最低正确率）
 *
 * 关键设计：每个路径节点可关联一个 subjectId（科目标识），
 * 解锁条件只统计对应科目的答题数据，防止用数学题解锁 Python 路径的环节。
 */

import type { LearningPath, LearningNode } from '../types';
import { mockLearningPath } from '../data/mockData';
import { loadPracticeState } from './practiceGrader';
import { loadPracticeState as loadMathPracticeState } from './mathPracticeGrader';

// ==================== 存储键名 ====================
const PATH_STATE_KEY = 'learningPathState';
const PATH_THRESHOLD_KEY = 'learningPathThreshold';

/** 解锁条件配置 */
export interface PathThreshold {
  /** 最少答题数量（达到此数量才能解锁下一章） */
  minQuestions: number;
  /** 最低正确率百分比（达到此正确率才能解锁下一章） */
  minAccuracy: number;
}

// ==================== 科目练习数据统计 ====================

/** 获取指定科目的练习统计（完成的题目数和正确率） */
export function getSubjectPracticeStats(subjectId: string | null | undefined): {
  completedCount: number;
  correctRate: number;
} {
  if (!subjectId) {
    // subjectId 为空/null 时不限定科目，汇总所有
    return getAllSubjectsStats();
  }

  if (subjectId === 'python') {
    const state = loadPracticeState();
    if (!state) return { completedCount: 0, correctRate: 0 };
    const completed = state.results.filter(r => r.isCorrect !== null || r.aiScore !== undefined).length;
    const correct = state.results.filter(r => r.isCorrect === true).length;
    return {
      completedCount: completed,
      correctRate: completed > 0 ? Math.round((correct / completed) * 100) : 0,
    };
  }

  if (subjectId === 'math') {
    const state = loadMathPracticeState();
    if (!state) return { completedCount: 0, correctRate: 0 };
    const completed = state.results.filter(r => r.isCorrect !== null || r.aiScore !== undefined).length;
    const correct = state.results.filter(r => r.isCorrect === true).length;
    return {
      completedCount: completed,
      correctRate: completed > 0 ? Math.round((correct / completed) * 100) : 0,
    };
  }

  return { completedCount: 0, correctRate: 0 };
}

/** 汇总所有科目的练习数据 */
function getAllSubjectsStats(): { completedCount: number; correctRate: number } {
  let totalCompleted = 0;
  let totalCorrect = 0;

  const pythonState = loadPracticeState();
  if (pythonState) {
    totalCompleted += pythonState.results.filter(r => r.isCorrect !== null || r.aiScore !== undefined).length;
    totalCorrect += pythonState.results.filter(r => r.isCorrect === true).length;
  }

  const mathState = loadMathPracticeState();
  if (mathState) {
    totalCompleted += mathState.results.filter(r => r.isCorrect !== null || r.aiScore !== undefined).length;
    totalCorrect += mathState.results.filter(r => r.isCorrect === true).length;
  }

  return {
    completedCount: totalCompleted,
    correctRate: totalCompleted > 0 ? Math.round((totalCorrect / totalCompleted) * 100) : 0,
  };
}

/** 获取当前路径节点所需的 subjectId */
export function getCurrentNodeSubjectId(): string | null {
  const path = getOrCreatePathState();
  const currentNode = path.nodes.find(n => n.id === path.currentNodeId);
  // 优先用节点自己的 subjectId，其次用路径默认的
  return currentNode?.subjectId ?? path.subjectId ?? null;
}

/** 默认解锁条件：至少答 5 题，正确率不低于 60% */
const DEFAULT_THRESHOLD: PathThreshold = {
  minQuestions: 5,
  minAccuracy: 60,
};

// ==================== 路径状态持久化 ====================

export function loadPathState(): LearningPath | null {
  try {
    const saved = localStorage.getItem(PATH_STATE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    // ignore
  }
  return null;
}

export function savePathState(path: LearningPath): void {
  localStorage.setItem(PATH_STATE_KEY, JSON.stringify(path));
  // 通知其他页面刷新
  window.dispatchEvent(new CustomEvent('pathStateUpdated'));
}

export function getOrCreatePathState(): LearningPath {
  const existing = loadPathState();
  if (existing) return existing;

  // 使用 mockData 的初始路径
  savePathState(mockLearningPath);
  return mockLearningPath;
}

export function resetPathState(): LearningPath {
  localStorage.removeItem(PATH_STATE_KEY);
  const fresh = { ...mockLearningPath, nodes: mockLearningPath.nodes.map(n => ({ ...n })) };
  savePathState(fresh);
  return fresh;
}

// ==================== 解锁条件管理 ====================

export function loadThreshold(): PathThreshold {
  try {
    const saved = localStorage.getItem(PATH_THRESHOLD_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_THRESHOLD };
}

export function saveThreshold(threshold: PathThreshold): void {
  localStorage.setItem(PATH_THRESHOLD_KEY, JSON.stringify(threshold));
}

// ==================== 路径节点操作 ====================

/**
 * 标记当前节点为已完成，并解锁下一个节点
 * @returns 更新后的路径
 */
export function completeCurrentNodeAndUnlockNext(): LearningPath | null {
  const path = getOrCreatePathState();
  const currentIndex = path.nodes.findIndex(n => n.id === path.currentNodeId);

  if (currentIndex === -1) return null;

  const updatedNodes = path.nodes.map((node, idx) => {
    if (idx === currentIndex) {
      // 当前节点标记为 completed
      return { ...node, status: 'completed' as const, progress: 100 };
    }
    if (idx === currentIndex + 1 && node.status === 'locked') {
      // 下一个节点解锁为 in-progress
      return { ...node, status: 'in-progress' as const, progress: 0 };
    }
    return node;
  });

  // 如果还有下一个节点，将 currentNodeId 指向它
  const nextNodeId = currentIndex + 1 < updatedNodes.length
    ? updatedNodes[currentIndex + 1].id
    : path.currentNodeId;

  const newPath: LearningPath = {
    ...path,
    nodes: updatedNodes,
    currentNodeId: nextNodeId,
  };

  savePathState(newPath);
  return newPath;
}

/**
 * 根据练习结果判断是否满足解锁条件
 */
export function checkThresholdMet(
  completedCount: number,
  correctRate: number,
  threshold?: PathThreshold
): { met: boolean; reason: string } {
  const t = threshold || loadThreshold();

  if (completedCount < t.minQuestions) {
    return {
      met: false,
      reason: `答题数量不足：已完成 ${completedCount}/${t.minQuestions} 题`,
    };
  }

  if (correctRate < t.minAccuracy) {
    return {
      met: false,
      reason: `正确率不足：当前 ${correctRate}%/${t.minAccuracy}%`,
    };
  }

  return {
    met: true,
    reason: `已达到解锁条件（答题${t.minQuestions}题，正确率${t.minAccuracy}%）`,
  };
}

/**
 * 获取当前节点在路径中的索引
 */
export function getCurrentNodeIndex(): number {
  const path = getOrCreatePathState();
  return path.nodes.findIndex(n => n.id === path.currentNodeId);
}

/**
 * 检查是否还有下一个节点
 */
export function hasNextNode(): boolean {
  const path = getOrCreatePathState();
  const currentIndex = path.nodes.findIndex(n => n.id === path.currentNodeId);
  return currentIndex >= 0 && currentIndex < path.nodes.length - 1;
}

/**
 * 更新路径中当前节点的进度百分比
 */
export function updateCurrentNodeProgress(progress: number): LearningPath | null {
  const path = getOrCreatePathState();
  const updatedNodes = path.nodes.map(node => {
    if (node.id === path.currentNodeId) {
      return { ...node, progress: Math.min(100, Math.max(0, progress)) };
    }
    return node;
  });
  const newPath = { ...path, nodes: updatedNodes };
  savePathState(newPath);
  return newPath;
}
