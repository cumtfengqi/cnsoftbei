import axios from 'axios';

// Minimax API 配置 - Anthropic API 兼容格式
const API_KEY = 'sk-cp-M-_jNzReYVMIzZg6a8AL1hdZWgP_-GHPRIHE-8lHMaGo14qzZH301EfQ81J8-yVxD0SDTQpqiCKwdEtTRIJ1jX5QoPD-EtYJhC9imCA3PTl1FBkNHQUQeRg';
// 使用相对路径，通过 Vite 代理转发
const BASE_URL = '/anthropic';

// 创建 axios 实例
const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY,
    'anthropic-version': '2023-06-01',
    'Authorization': `Bearer ${API_KEY}`,
  },
  timeout: 120000,
});

// 消息类型 - Anthropic 格式
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Anthropic API 请求格式
interface AnthropicRequest {
  model: string;
  max_tokens: number;
  system?: string;
  messages: { role: string; content: string }[];
  stream?: boolean;
}

/**
 * 调用大模型进行对话 - Anthropic API 兼容
 */
export async function chatCompletion(
  messages: ChatMessage[]
): Promise<string> {
  try {
    // 将 messages 转换为 Anthropic 格式
    const anthropicMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const systemMessage = messages.find(m => m.role === 'system');

    const requestData: AnthropicRequest = {
      model: 'MiniMax-M2.7',
      max_tokens: 4096,
      system: systemMessage?.content,
      messages: anthropicMessages,
      stream: false,
    };

    const response = await apiClient.post('/v1/messages', requestData);

    console.log('API Response:', JSON.stringify(response.data, null, 2));

    const result = response.data;

    // Anthropic API 响应格式
    if (result.content && Array.isArray(result.content)) {
      // 查找 text 类型的 content block
      const textBlock = result.content.find((block: any) => block.type === 'text');
      if (textBlock && textBlock.text) {
        return textBlock.text;
      }
      // 如果没有 text block，可能有其他类型
      if (result.content[0]) {
        return result.content[0].text || JSON.stringify(result.content[0]);
      }
    }

    throw new Error(`Invalid response format: ${JSON.stringify(result).substring(0, 200)}`);
  } catch (error: any) {
    console.error('API call failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * 流式调用大模型 - Anthropic API 兼容
 */
export async function* streamChatCompletion(
  messages: ChatMessage[]
): AsyncGenerator<string> {
  try {
    const anthropicMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const systemMessage = messages.find(m => m.role === 'system');

    const requestData: AnthropicRequest = {
      model: 'MiniMax-M2.7',
      max_tokens: 4096,
      system: systemMessage?.content,
      messages: anthropicMessages,
      stream: true,
    };

    const response = await apiClient.post('/v1/messages', requestData, {
      responseType: 'stream',
    });

    const stream = response.data;
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim() && line.startsWith('data:')) {
          try {
            const data = JSON.parse(line.replace('data:', ''));
            if (data.type === 'content_block_delta') {
              if (data.delta?.type === 'text_delta' && data.delta?.text) {
                yield data.delta.text;
              }
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    }
  } catch (error) {
    console.error('Stream API call failed:', error);
    throw error;
  }
}

export default apiClient;
