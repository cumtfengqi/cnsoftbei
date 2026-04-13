import { useState } from 'react';
import { Card, Typography, Tag, Space, Button, Modal, Form, Input, Select, Slider, Progress, message, Row, Col, Descriptions, Avatar } from 'antd';
import { UserOutlined, EditOutlined, SaveOutlined, ReloadOutlined } from '@ant-design/icons';
import { initialProfile } from '../data/mockData';
import type { StudentProfile, ProfileDimension } from '../types';

const { Title, Text } = Typography;
const { TextArea } = Input;

const Profile: React.FC = () => {
  const [profile, setProfile] = useState<StudentProfile>(initialProfile);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([
    { role: 'assistant', content: '你好！我是画像构建智能体，通过对话我可以了解你的学习特征，帮你构建个性化学习画像。' },
    { role: 'assistant', content: '请告诉我：你的专业是什么？目前在学习哪些课程？有什么学习目标？' },
  ]);
  const [inputValue, setInputValue] = useState('');

  const [form] = Form.useForm();

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

  const handleChatSend = () => {
    if (!inputValue.trim()) return;

    setChatMessages(prev => [...prev, { role: 'user', content: inputValue }]);
    const userInput = inputValue;
    setInputValue('');

    // 模拟智能体回复
    setTimeout(() => {
      let response = '';
      if (userInput.includes('人工智能') || userInput.includes('AI')) {
        response = '人工智能是非常热门的方向！基于你的兴趣，我可以为你推荐机器学习、深度学习相关的学习路径。你目前对哪些具体方向更感兴趣？';
      } else if (userInput.includes('Python') || userInput.includes('编程')) {
        response = '好的，Python基础对于计算机专业非常重要。我注意到你提到对面向对象编程有些薄弱，这在资源生成时会重点关注。你平时是怎么学习编程的？';
      } else {
        response = '明白了，让我分析一下你的学习需求。我会基于你提供的信息更新你的学习画像，包括知识基础、认知风格等多个维度。';
      }
      setChatMessages(prev => [...prev, { role: 'assistant', content: response }]);
    }, 1000);
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
              <Button icon={<EditOutlined />} onClick={() => setIsModalOpen(true)}>
                编辑画像
              </Button>
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
                <Avatar size="small" style={{ background: '#1890ff' }}>构</Avatar>
                <span>对话式画像构建</span>
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
                      <Avatar size="small" style={{ background: '#1890ff' }}>AI</Avatar>
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
                    </div>
                    {msg.role === 'user' && (
                      <Avatar size="small" style={{ background: '#52c41a' }}>我</Avatar>
                    )}
                  </Space>
                </div>
              ))}
            </div>
            <Space.Compact style={{ width: '100%' }}>
              <Input
                placeholder="输入你的学习情况..."
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onPressEnter={handleChatSend}
              />
              <Button type="primary" onClick={handleChatSend}>发送</Button>
            </Space.Compact>
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
            <Slider marks={{ 高: '高', 中: '中', 低: '低' }} min={1} max={3} step={null} />
          </Form.Item>
          <Space>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleAddDimension}>
              保存
            </Button>
            <Button onClick={() => setIsModalOpen(false)}>取消</Button>
            <Button icon={<ReloadOutlined />}>重新分析</Button>
          </Space>
        </Form>
      </Modal>
    </div>
  );
};

export default Profile;
