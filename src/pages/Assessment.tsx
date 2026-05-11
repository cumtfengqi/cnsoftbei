import React, { useState, useEffect } from 'react';
import {
  Card, Typography, Tag, Space, Row, Col, Progress,
  List, Avatar, Statistic, Timeline, Button, Alert
} from 'antd';
import {
  DashboardOutlined,
  RiseOutlined,
  FallOutlined,
  MinusOutlined,
  TrophyOutlined,
  FireOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import { mockAssessments, mockLearningPath, learningStats, assessmentSuggestions } from '../data/mockData';
import { loadPracticeState, learningPlan } from '../services/practiceGrader';
import type { PracticeState } from '../types';

const { Title, Text } = Typography;

const Assessment: React.FC = () => {
  interface AssessmentDisplay {
    dimension: string;
    score: number;
    trend: 'up' | 'down' | 'stable';
    feedback: string;
    color: string;
  }
  const [practiceState, setPracticeState] = useState<PracticeState | null>(null);

  // 加载练习数据
  const loadData = () => {
    const state = loadPracticeState();
    setPracticeState(state);
  };

  useEffect(() => {
    loadData();
    // 监听 storage 变化（跨页面同步）
    const handler = () => loadData();
    window.addEventListener('storage', handler);
    window.addEventListener('practiceStateUpdated', handler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('practiceStateUpdated', handler);
    };
  }, []);

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <RiseOutlined style={{ color: '#52c41a' }} />;
      case 'down': return <FallOutlined style={{ color: '#f5222d' }} />;
      default: return <MinusOutlined style={{ color: '#d9d9d9' }} />;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up': return 'success';
      case 'down': return 'danger';
      default: return 'default';
    }
  };

  // 从练习数据计算统计
  const completedQuestions = practiceState?.results.length ?? 0;
  const totalQuestions = 48; // 固定题库总数
  const correctCount = practiceState?.results.filter(r => r.isCorrect).length ?? 0;
  const accuracy = completedQuestions > 0 ? Math.round((correctCount / completedQuestions) * 100) : 0;
  const completedModules = practiceState?.moduleProgress.filter(m => m.completedQuestions === m.totalQuestions).length ?? 0;
  const totalModules = learningPlan.modules.length;

  // 真实评估数据
  const assessmentItems: AssessmentDisplay[] = practiceState
    ? practiceState.tagScores.map((ts, idx) => {
        const colors = ['#1890ff', '#52c41a', '#faad14', '#722ed1', '#eb2f96', '#13c2c2'];
        return {
          dimension: tagToChinese(ts.tag),
          score: ts.score,
          trend: idx === 0 ? 'up' : 'stable' as 'up' | 'down' | 'stable',
          feedback: ts.totalAnswered > 0
            ? `已完成 ${ts.totalAnswered} 题，正确率 ${ts.score}%`
            : '暂无练习数据',
          color: colors[idx % colors.length],
        };
      })
    : mockAssessments.map((item, idx) => {
        const colors = ['#1890ff', '#52c41a', '#faad14', '#722ed1', '#eb2f96', '#13c2c2'];
        return { ...item, color: colors[idx % colors.length] } as AssessmentDisplay;
      });

  // 计算总体评分
  const overallScore = assessmentItems.reduce((sum, a) => sum + a.score, 0) / (assessmentItems.length || 1);

  // 是否在 Practice 页面已触发过更新（通过自定义事件通知）
  useEffect(() => {
    const handleUpdate = () => loadData();
    window.addEventListener('practiceStateUpdated', handleUpdate);
    return () => window.removeEventListener('practiceStateUpdated', handleUpdate);
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>学习效果评估</Title>
      <Text type="secondary">多维度精准评估学习效果，动态调整学习方案</Text>

      {/* 练习引导 */}
      {!practiceState || practiceState.results.length === 0 ? (
        <Alert
          type="info"
          showIcon
          icon={<RocketOutlined />}
          message="还没有开始练习"
          description="前往「练习中心」开始做题，系统将根据你的答题情况自动更新学习画像和效果评估。"
          style={{ marginTop: 16 }}
          action={
            <Button size="small" onClick={() => {
              const event = new CustomEvent('navigateToPage', { detail: 'practice' });
              window.dispatchEvent(event);
            }}>
              去练习中心
            </Button>
          }
        />
      ) : null}

      {/* 总体评分 */}
      <Row gutter={16} style={{ marginTop: 24 }}>
        <Col span={6}>
          <Card style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff' }}>
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>总体评分</span>}
              value={Math.round(overallScore)}
              suffix="分"
              valueStyle={{ color: '#fff', fontSize: 48 }}
              prefix={<TrophyOutlined />}
            />
            <div style={{ marginTop: 8, color: 'rgba(255,255,255,0.8)' }}>
              <Space>
                {getTrendIcon('up')}
                <span>较上周提升 {completedQuestions > 0 ? Math.round(accuracy / 10) : 0}%</span>
              </Space>
            </div>
          </Card>
        </Col>

        {/* 动态练习统计 */}
        {practiceState && practiceState.results.length > 0 ? (
          <>
            <Col span={6}>
              <Card>
                <Statistic
                  title="已完成题目"
                  value={completedQuestions}
                  suffix={`/ ${totalQuestions}`}
                  prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                />
                <Progress
                  percent={Math.round((completedQuestions / totalQuestions) * 100)}
                  size="small"
                  showInfo={false}
                  style={{ marginTop: 8 }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="正确率"
                  value={accuracy}
                  suffix="%"
                  prefix={<RiseOutlined style={{ color: '#faad14' }} />}
                />
                <Tag icon={<CheckCircleOutlined />} color="success" style={{ marginTop: 8 }}>
                  正确 {correctCount} 题
                </Tag>
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="模块完成"
                  value={`${completedModules}/${totalModules}`}
                  prefix={<DashboardOutlined style={{ color: '#722ed1' }} />}
                />
                <Tag icon={<FireOutlined />} color="processing" style={{ marginTop: 8 }}>
                  {totalModules - completedModules} 个进行中
                </Tag>
              </Card>
            </Col>
          </>
        ) : (
          learningStats.map((stat, index) => (
            <Col span={6} key={index}>
              <Card>
                <Statistic
                  title={stat.label}
                  value={stat.value}
                  suffix={stat.unit}
                  prefix={index === 0 ? <ClockCircleOutlined /> : index === 1 ? <FireOutlined /> : <CheckCircleOutlined />}
                />
                <Tag
                  icon={getTrendIcon(stat.trend)}
                  color={getTrendColor(stat.trend)}
                  style={{ marginTop: 8 }}
                >
                  {stat.trendValue}
                </Tag>
              </Card>
            </Col>
          ))
        )}
      </Row>

      <Row gutter={24} style={{ marginTop: 24 }}>
        {/* 能力雷达图 */}
        <Col span={12}>
          <Card title="能力雷达图">
            {/* TODO: 使用 Recharts RadarChart 替换 */}
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d9d9d9' }}>
              {practiceState && practiceState.results.length > 0
                ? '雷达图组件待接入'
                : '开始练习后可查看能力雷达图'}
            </div>
          </Card>
        </Col>

        {/* 评估详情 */}
        <Col span={12}>
          <Card title="多维度评估详情">
            <List
              dataSource={assessmentItems}
              renderItem={(item) => (
                <List.Item>
                  <Card
                    size="small"
                    style={{ width: '100%', borderLeft: `3px solid ${item.color}` }}
                  >
                    <Row gutter={16} align="middle">
                      <Col span={12}>
                        <Space>
                          <Text strong>{item.dimension}</Text>
                          <Tag icon={getTrendIcon(item.trend)} color={getTrendColor(item.trend)}>
                            {item.trend === 'up' ? '提升' : item.trend === 'down' ? '下降' : '稳定'}
                          </Tag>
                        </Space>
                        <br />
                        <Text type="secondary" style={{ fontSize: 12 }}>{item.feedback}</Text>
                      </Col>
                      <Col span={8}>
                        <Progress
                          percent={item.score}
                          size="small"
                          strokeColor={item.score >= 80 ? '#52c41a' : item.score >= 60 ? '#faad14' : '#f5222d'}
                        />
                      </Col>
                      <Col span={4} style={{ textAlign: 'right' }}>
                        <Text strong style={{ fontSize: 24 }}>{item.score}</Text>
                        <Text type="secondary">分</Text>
                      </Col>
                    </Row>
                  </Card>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      {/* 练习模块进度 */}
      {practiceState && practiceState.results.length > 0 && (
        <Card title="练习模块进度" style={{ marginTop: 24 }}>
          <Row gutter={16}>
            {practiceState.moduleProgress.map((module, index) => (
              <Col span={6} key={module.moduleId}>
                <Card size="small" style={{ textAlign: 'center' }}>
                  <Avatar
                    size={48}
                    style={{
                      background: module.score >= 80 ? '#52c41a' : module.score >= 50 ? '#1890ff' : '#d9d9d9',
                      marginBottom: 8,
                    }}
                  >
                    {index + 1}
                  </Avatar>
                  <br />
                  <Text strong style={{ fontSize: 12 }}>{module.moduleName}</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {module.completedQuestions}/{module.totalQuestions} 题
                  </Text>
                  <Progress
                    percent={module.score}
                    size="small"
                    strokeColor={module.score >= 80 ? '#52c41a' : '#1890ff'}
                    style={{ marginTop: 8 }}
                  />
                  <Tag
                    color={module.score >= 80 ? 'success' : module.score >= 50 ? 'processing' : 'default'}
                    style={{ marginTop: 4 }}
                  >
                    {module.score}分
                  </Tag>
                </Card>
              </Col>
            ))}
          </Row>
        </Card>
      )}

      {/* 学习路径完成情况（备用） */}
      {(!practiceState || practiceState.results.length === 0) && (
        <Card title="学习路径完成情况" style={{ marginTop: 24 }}>
          <Row gutter={16}>
            {mockLearningPath.nodes.map((node, index) => (
              <Col span={6} key={node.id}>
                <Card size="small" style={{ textAlign: 'center' }}>
                  <Avatar
                    size={48}
                    style={{
                      background: node.status === 'completed' ? '#52c41a' : node.status === 'in-progress' ? '#1890ff' : '#d9d9d9',
                      marginBottom: 8,
                    }}
                  >
                    {index + 1}
                  </Avatar>
                  <br />
                  <Text strong style={{ fontSize: 12 }}>{node.title}</Text>
                  <br />
                  <Progress
                    percent={node.progress}
                    size="small"
                    strokeColor={node.status === 'completed' ? '#52c41a' : '#1890ff'}
                    style={{ marginTop: 8 }}
                  />
                  <Tag
                    color={node.status === 'completed' ? 'success' : node.status === 'in-progress' ? 'processing' : 'default'}
                    style={{ marginTop: 4 }}
                  >
                    {node.status === 'completed' ? '已完成' : node.status === 'in-progress' ? '进行中' : '未开始'}
                  </Tag>
                </Card>
              </Col>
            ))}
          </Row>
        </Card>
      )}

      {/* 智能调整建议 */}
      <Card title="智能调整建议" style={{ marginTop: 24 }}>
        <Timeline
          items={assessmentSuggestions.map(item => {
            const dotIconMap: Record<string, React.ReactNode> = {
              DashboardOutlined: <DashboardOutlined />,
              CheckCircleOutlined: <CheckCircleOutlined />,
              FireOutlined: <FireOutlined />,
            };
            return {
              color: item.color,
              dot: dotIconMap[item.dotIcon] || <DashboardOutlined />,
              children: (
                <Space direction="vertical">
                  <Text strong>{item.title}</Text>
                  <Text type="secondary">{item.description}</Text>
                </Space>
              ),
            };
          })}
        />
      </Card>
    </div>
  );
};

// Tag 中文映射
function tagToChinese(tag: string): string {
  const map: Record<string, string> = {
    syntax: '语法基础',
    'data-types': '数据类型',
    operators: '运算符',
    'control-flow': '流程控制',
    functions: '函数',
    modules: '模块',
    scope: '作用域',
    OOP: '面向对象',
    classes: '类与对象',
    inheritance: '继承',
    polymorphism: '多态',
    exceptions: '异常处理',
    files: '文件操作',
    decorators: '装饰器',
    comprehensions: '推导式',
    errorProne: '易错点',
    studyHabit: '学习习惯',
  };
  return map[tag] || tag;
}

export default Assessment;
