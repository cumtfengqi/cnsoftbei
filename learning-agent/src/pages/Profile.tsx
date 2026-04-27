import { useState, useRef, useEffect } from 'react';
import { Card, Typography, Tag, Space, Button, Modal, Form, Input, Select, Slider, Progress, message, Row, Col, Descriptions, Avatar, Spin } from 'antd';
import { UserOutlined, EditOutlined, SaveOutlined, ReloadOutlined, SendOutlined, RobotOutlined, LoadingOutlined } from '@ant-design/icons';
import { initialProfile } from '../data/mockData';
import { streamChatCompletion } from '../services/api';
import type { StudentProfile, ProfileDimension } from '../types';

const { Title, Text } = Typography;
const { TextArea } = Input;

const Profile: React.FC = () => {
  const [profile, setProfile] = useState<StudentProfile>(initialProfile);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string; isStreaming?: boolean }[]>([
    { role: 'assistant', content: '你好！我是画像构建智能体，通过对话我可以了解你的学习特征，帮你构建个性化学习画像。' },
    { role: 'assistant', content: '请告诉我：你的专业是什么？目前在学习哪些课程？有什么学习目标？' },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentReply, setCurrentReply] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const [form] = Form.useForm();

  // 自动滚动到底部
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, currentReply]);

  // 调用AI分析用户输入并更新画像（流式）
  const analyzeAndUpdateProfile = async (userMessage: string) => {
    setIsAnalyzing(true);
    setCurrentReply('');

    try {
      // 构建分析请求
      const messages = [
        { role: 'system' as const, content: `你是画像构建智能体，专门分析学生的学习特征。
当前学生画像：
姓名：${profile.name}
专业：${profile.major}
年级：${profile.grade}

已有维度：
${profile.dimensions.map(d => `- ${d.label}: ${d.value} (${d.level})`).join('\n')}

请分析用户的下一条输入，提取或更新以下维度的信息：
1. 知识基础 - 用户当前的技术水平
2. 认知风格 - 用户喜欢的学习方式（视觉/听觉/动手等）
3. 易错点偏好 - 用户经常遇到困难的地方
4. 学习节奏 - 用户学习的快慢和习惯
5. 兴趣方向 - 用户感兴趣的技术领域
6. 学习习惯 - 用户的学习方法和习惯

请用JSON格式输出分析结果，格式如下（只输出JSON，不要其他内容）：
{
  "knowledgeBase": "分析出的知识基础描述",
  "cognitiveStyle": "分析出的认知风格",
  "errorProne": "分析出的易错点",
  "learningPace": "分析出的学习节奏",
  "interestDirection": "分析出的兴趣方向",
  "studyHabit": "分析出的学习习惯"
}` },
        { role: 'user' as const, content: userMessage },
      ];

      let fullResponse = '';
      let hasAnalysis = false;

      // 使用流式调用
      await streamChatCompletion(
        messages,
        (chunk, isThinking) => {
          if (!isThinking) {
            fullResponse += chunk;
            // 实时更新回复（用于分析JSON输出后的部分）
            if (hasAnalysis && chunk.length > 0) {
              setCurrentReply(prev => prev + chunk);
            }
          }
        },
        () => {
          // 处理思考过程
        }
      );

      // 尝试解析JSON响应
      try {
        // 提取JSON（可能在markdown代码块中）
        let jsonStr = fullResponse;
        const jsonMatch = fullResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || fullResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonStr = jsonMatch[1] || jsonMatch[0];
        }

        const analysis = JSON.parse(jsonStr.includes('{') ? jsonStr.substring(jsonStr.indexOf('{')).replace(/```/g, '') : jsonStr);
        hasAnalysis = true;

        // 更新画像维度
        setProfile(prev => {
          const updatedDimensions = [...prev.dimensions];

          const dimensionKeys: (keyof typeof analysis)[] = [
            'knowledgeBase', 'cognitiveStyle', 'errorProne',
            'learningPace', 'interestDirection', 'studyHabit'
          ];

          dimensionKeys.forEach((key, index) => {
            if (analysis[key]) {
              let level: '高' | '中' | '低' = '中';
              const content = analysis[key].toLowerCase();
              if (content.includes('强') || content.includes('扎实') || content.includes('熟练')) {
                level = '高';
              } else if (content.includes('弱') || content.includes('薄弱') || content.includes('不足')) {
                level = '低';
              }

              if (updatedDimensions[index]) {
                updatedDimensions[index] = {
                  ...updatedDimensions[index],
                  value: analysis[key],
                  level,
                };
              }
            }
          });

          return {
            ...prev,
            dimensions: updatedDimensions,
            updatedAt: new Date().toISOString(),
          };
        });

        localStorage.setItem('studentProfile', JSON.stringify(profile));

      } catch (parseError) {
        console.error('Failed to parse analysis result:', parseError);
      }

      // 生成简短的智能体回复
      const replyMessages = [
        { role: 'system' as const, content: `你是画像构建智能体，友好、专业地回应用户的输入。根据刚才的分析结果，给出一个简短（50字以内）的肯定性回复，并可以追问一个关于学习的问题。用户输入是："${userMessage}"` },
        { role: 'assistant' as const, content: '' },
      ];

      let replyContent = '';
      await streamChatCompletion(
        replyMessages,
        (chunk, isThinking) => {
          if (!isThinking) {
            replyContent += chunk;
            setCurrentReply(replyContent);
          }
        }
      );

      setChatMessages(prev => [...prev, { role: 'assistant', content: replyContent }]);
      setCurrentReply('');
      message.success('画像已更新');

    } catch (error: any) {
      console.error('Profile analysis failed:', error);
      const simpleResponse = generateSimpleResponse(userMessage);
      setChatMessages(prev => [...prev, { role: 'assistant', content: simpleResponse }]);
      setCurrentReply('');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 简单的本地分析（API失败时降级）
  const generateSimpleResponse = (message: string): string => {
    const msg = message.toLowerCase();
    if (msg.includes('python') || msg.includes('编程')) {
      return '好的，我已经记录了您的编程学习背景。基于这个信息，我会为您推荐相关的学习资源和练习题目。';
    }
    if (msg.includes('人工智能') || msg.includes('ai') || msg.includes('机器学习')) {
      return '人工智能是非常热门的研究方向！我会为您规划相关的学习路径，包括数学基础、机器学习算法到深度学习。';
    }
    if (msg.includes('基础') || msg.includes('薄弱')) {
      return '明白了，我会针对您的知识基础调整学习内容的难度，确保您能够循序渐进地掌握知识。';
    }
    return '收到！我已经根据您的描述更新了学习画像。您可以继续告诉我更多关于您的学习情况，我会不断完善画像。';
  };

  const handleChatSend = async () => {
    if (!inputValue.trim()) return;
    if (isAnalyzing) return;

    const userMessage = inputValue;
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInputValue('');

    await analyzeAndUpdateProfile(userMessage);
  };

  const handleAddDimension = () => {
    form.validateFields().then(values => {
      const newDimension: ProfileDimension = {
        key: `dim-${Date.now()}`,
        label: values.label,
        value: values.value,
        level: values.level,
      };
      setProfile(prev => ({
        ...prev,
        dimensions: [...prev.dimensions, newDimension],
        updatedAt: new Date().toISOString(),
      }));
      message.success('已添加新的画像维度');
      form.resetFields();
    });
  };

  const loadSavedProfile = () => {
    const saved = localStorage.getItem('studentProfile');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setProfile(parsed);
        message.success('已加载保存的画像');
      } catch {
        message.error('加载失败');
      }
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case '高': return 'success';
      case '中': return 'processing';
      case '低': return 'warning';
      default: return 'default';
    }
  };

  const getLevelProgress = (level: string) => {
    switch (level) {
      case '高': return 90;
      case '中': return 60;
      case '低': return 30;
      default: return 50;
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>学习画像</Title>
      <Text type="secondary">基于对话构建的个性化学习特征分析</Text>

      <Row gutter={24} style={{ marginTop: 24 }}>
        {/* 左侧：画像展示 */}
        <Col span={14}>
          <Card
            title={
              <Space>
                <UserOutlined />
                <span>我的学习画像</span>
              </Space>
            }
            extra={
              <Space>
                <Button icon={<ReloadOutlined />} onClick={loadSavedProfile} size="small">
                  加载已保存
                </Button>
                <Button icon={<EditOutlined />} onClick={() => setIsModalOpen(true)}>
                  编辑画像
                </Button>
              </Space>
            }
          >
            <Descriptions bordered column={2}>
              <Descriptions.Item label="姓名">{profile.name}</Descriptions.Item>
              <Descriptions.Item label="专业">{profile.major}</Descriptions.Item>
              <Descriptions.Item label="年级">{profile.grade}</Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {new Date(profile.updatedAt).toLocaleDateString()}
              </Descriptions.Item>
            </Descriptions>

            <div style={{ marginTop: 24 }}>
              <Title level={5}>六大维度分析</Title>
              <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                系统通过对话自动分析您的学习特征，构建包含6个维度的动态画像
              </Text>

              <Space direction="vertical" style={{ width: '100%' }} size="large">
                {profile.dimensions.map((dim, index) => (
                  <Card key={index} size="small" style={{ background: '#fafafa' }}>
                    <Row gutter={16} align="middle">
                      <Col span={4}>
                        <Space direction="vertical">
                          <Avatar style={{ background: dim.level === '高' ? '#52c41a' : dim.level === '中' ? '#1890ff' : '#faad14' }}>
                            {dim.label[0]}
                          </Avatar>
                          <Tag color={getLevelColor(dim.level)}>{dim.level}</Tag>
                        </Space>
                      </Col>
                      <Col span={16}>
                        <Text strong>{dim.label}</Text>
                        <br />
                        <Text type="secondary">{dim.value}</Text>
                      </Col>
                      <Col span={4}>
                        <Progress
                          percent={getLevelProgress(dim.level)}
                          size="small"
                          showInfo={false}
                          strokeColor={dim.level === '高' ? '#52c41a' : dim.level === '中' ? '#1890ff' : '#faad14'}
                        />
                      </Col>
                    </Row>
                  </Card>
                ))}
              </Space>
            </div>
          </Card>
        </Col>

        {/* 右侧：对话式画像构建 */}
        <Col span={10}>
          <Card
            title={
              <Space>
                <Avatar size="small" style={{ background: '#1890ff' }} icon={<RobotOutlined />} />
                <span>对话式画像构建</span>
                {isAnalyzing && <Tag color="processing" icon={<LoadingOutlined />}>AI分析中</Tag>}
              </Space>
            }
            style={{ height: '100%' }}
          >
            <div style={{ height: 400, overflowY: 'auto', marginBottom: 16, padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
              {chatMessages.map((msg, index) => (
                <div
                  key={index}
                  style={{
                    textAlign: msg.role === 'user' ? 'right' : 'left',
                    marginBottom: 12,
                  }}
                >
                  <Space align="start" style={{ justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    {msg.role === 'assistant' && (
                      <Avatar size="small" style={{ background: '#1890ff' }} icon={<RobotOutlined />} />
                    )}
                    <div
                      style={{
                        padding: '8px 12px',
                        borderRadius: 8,
                        background: msg.role === 'user' ? '#1890ff' : '#fff',
                        color: msg.role === 'user' ? '#fff' : '#000',
                        maxWidth: '80%',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                      }}
                    >
                      {msg.content}
                      {msg.isStreaming && <span style={{ animation: 'blink 1s infinite' }}>|</span>}
                    </div>
                    {msg.role === 'user' && (
                      <Avatar size="small" style={{ background: '#52c41a' }}>我</Avatar>
                    )}
                  </Space>
                </div>
              ))}

              {/* 正在生成的回复 */}
              {currentReply && (
                <div style={{ textAlign: 'left', marginBottom: 12 }}>
                  <Space align="start">
                    <Avatar size="small" style={{ background: '#1890ff' }} icon={<RobotOutlined />} />
                    <div
                      style={{
                        padding: '8px 12px',
                        borderRadius: 8,
                        background: '#fff',
                        maxWidth: '80%',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                      }}
                    >
                      {currentReply}
                      <span style={{ display: 'inline-block', width: 8, height: 16, background: '#1890ff', marginLeft: 2, animation: 'blink 1s infinite', verticalAlign: 'middle' }} />
                    </div>
                  </Space>
                </div>
              )}

              {isAnalyzing && !currentReply && (
                <div style={{ textAlign: 'left', marginBottom: 12 }}>
                  <Space align="start">
                    <Avatar size="small" style={{ background: '#1890ff' }} icon={<RobotOutlined />} />
                    <div style={{ padding: '8px 12px', borderRadius: 8, background: '#fff' }}>
                      <Spin size="small" /> 正在分析您的学习特征...
                    </div>
                  </Space>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            <Space.Compact style={{ width: '100%' }}>
              <Input
                placeholder="输入你的学习情况..."
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onPressEnter={handleChatSend}
                disabled={isAnalyzing}
              />
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleChatSend}
                loading={isAnalyzing}
              >
                发送
              </Button>
            </Space.Compact>
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                提示：告诉我您的专业、学习目标、兴趣方向等信息，我会自动分析并更新您的学习画像
              </Text>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 添加新维度弹窗 */}
      <Modal
        title="编辑学习画像"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="label" label="维度名称" rules={[{ required: true, message: '请输入维度名称' }]}>
            <Select
              placeholder="选择或输入维度名称"
              options={[
                { label: '知识基础', value: '知识基础' },
                { label: '认知风格', value: '认知风格' },
                { label: '易错点偏好', value: '易错点偏好' },
                { label: '学习节奏', value: '学习节奏' },
                { label: '兴趣方向', value: '兴趣方向' },
                { label: '学习习惯', value: '学习习惯' },
              ]}
            />
          </Form.Item>
          <Form.Item name="value" label="具体描述" rules={[{ required: true, message: '请输入具体描述' }]}>
            <TextArea rows={3} placeholder="详细描述该维度的特征..." />
          </Form.Item>
          <Form.Item name="level" label="水平等级" rules={[{ required: true, message: '请选择等级' }]}>
            <Slider marks={{ '高': '高', '中': '中', '低': '低' }} min={1} max={3} step={null} />
          </Form.Item>
          <Space>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleAddDimension}>
              保存
            </Button>
            <Button onClick={() => setIsModalOpen(false)}>取消</Button>
          </Space>
        </Form>
      </Modal>

      {/* 添加闪烁动画样式 */}
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default Profile;