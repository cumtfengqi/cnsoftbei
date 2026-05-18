# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个"学习智能体系统"，参赛于第十五届中国软件杯 - A3赛题。它是一个 AI 驱动的个性化学习平台，通过多智能体协作（画像构建、资源生成、路径规划、智能辅导、学习评估）提供学习支持。前端使用 React + TypeScript + Vite + Ant Design，后端调用 MiniMax-M2.7 大模型（兼容 Anthropic API 格式）。

## 常用命令

```bash
npm run dev       # 启动 Vite 开发服务器（含 HMR）
npm run build     # tsc -b 类型检查 + vite build 生产构建
npm run lint      # ESLint 检查
npm run preview   # 预览 dist/ 构建产物
```

项目没有测试框架，没有 `npm test` 脚本。

## 核心架构

### 路由（手动切换，非 React Router）

App.tsx 使用 `useState` 管理当前页面 key，通过 `switch` 语句渲染对应页面组件。SideMenu 组件通过 `onMenuSelect` 回调切换页面。7 个页面：`home`, `profile`, `resources`, `path`, `practice`, `tutor`, `assessment`。

### 状态管理

无全局状态管理库。每个页面使用本地 `useState`。跨页面切换时，`PageCacheContext`（`src/context/PageCacheContext.tsx`）通过 `useRef` 缓存页面状态，防止导航导致数据丢失。各页面通过 `usePageCache(pageKey)` hook 读写缓存。

### API 层（`src/services/api.ts`）

与 MiniMax-M2.7 通信，兼容 Anthropic API 格式。Vite 开发服务器将 `/anthropic` 代理到 `https://api.minimaxi.com/anthropic`（见 `vite.config.ts`）。

两个核心函数：
- `chatCompletion()` — 非流式，axios + 最多 3 次重试，超时 3 分钟
- `streamChatCompletion()` — 流式，fetch + ReadableStream，用于打字机效果，通过回调 `onChunk` / `onThinking` 推送增量内容

**注意**：API Key 硬编码在 `api.ts` 第 4 行，不应提交到公开仓库。

### 多智能体框架（`src/services/multiAgentFramework.ts`）

`MultiAgentScheduler` 类管理 5 个智能体角色（profile, resource, path, tutor, assessment）的任务调度、状态管理和协作。支持单智能体执行和流水线式多智能体协作。`ResourceGenerator` 在此基础上封装了 6 种资源类型（document, mindmap, quiz, reading, video, codeCase）的批量生成。

### 页面功能状态

| 页面 | 状态 | 说明 |
|------|------|------|
| Home | 静态 mock 数据 | 仪表盘 |
| Profile | ✅ 已接入 API | 对话式画像构建，AI 分析输入更新 6 维度画像，持久化到 localStorage |
| Resources | ✅ 已接入 API | 多智能体资源生成，支持流式展示生成进度 |
| Path | ✅ 已接入 API | AI 生成个性化学习路径，含阶段划分和时间估算 |
| **Practice** | ✅ 已接入 API + localStorage | Python 练习中心（48题，判断/选择/简答），客观题自动判分，简答题 AI 判分，做题结果关联画像维度，进度持久化 |
| Tutor | ✅ 已接入 API + 多项优化 | 流式问答，4 种解答模式（文字/图解/视频/代码），历史记录管理，回答缓存，点踩重新生成 |
| Assessment | ✅ 已与 Practice 打通 | 读取真实练习数据展示进度，无练习记录时显示引导提示 |

### Markdown 渲染

`MarkdownRenderer.tsx` 基于 `react-markdown` + `remark-gfm` + `react-syntax-highlighter`（Prism + oneDark 主题），用于渲染 AI 生成的内容。

### 练习中心（`src/pages/Practice.tsx`）

题库数据与组件完全解耦，存储在 `src/data/practiceQuestionBank.json`（54 道 Python 题目，4 个模块，判断/选择/简答三种题型）。`src/services/practiceGrader.ts` 负责：
- 客观题自动判分
- 简答题 AI 判分（调用 `streamChatCompletion`）
- 题目按 Tag 关联画像维度，做题后自动更新画像
- 结果写入 `practiceState` localStorage，`Assessment` 页面通过 `practiceStateUpdated` 事件跨页面同步刷新

### 智能辅导（`src/pages/Tutor.tsx`）

2026-05-18 优化（两轮）：

- **历史管理**：点击查看详情弹窗、删除（级联删除追问）、赞/踩变色反馈
- **缓存去重**：按 `问题|||模式` 缓存，历史匹配同时校验问题+模式，不同模式独立记录；快捷问题已缓存标签
- **点踩重生成**：点踩仅标记，再次提问时触发 AI 重新回答（含原因分析+全新解答）
- **画像关联**：读取 `localStorage.studentProfile` 注入 system prompt，AI 根据 6 维度调整回答风格和深度
- **请求取消**：`streamChatCompletion` 支持 `AbortSignal`，生成中红色取消按钮
- **追问链**：`QAItem` 新增 `parentId`/`followUpIds`，历史项和当前回答均有追问按钮；追问上下文传入 API；追问缩进子条目展示；详情弹窗展示完整追问链

## 项目文档

- `功能实现进度.md` — 功能实现状态清单（中文，最后更新 2026-04-27）
- `未完成功能实现计划.md` — 赛题要求差距分析与实现计划（中文，v1.0）
