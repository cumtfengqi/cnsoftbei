import axios from 'axios';

// Minimax API 配置 - Anthropic API 兼容格式
const API_KEY = 'sk-cp-M-_jNzReYVMIzZg6a8AL1hdZWgP_-GHPRIHE-8lHMaGo14qzZH301EfQ81J8-yVxD0SDTQpqiCKwdEtTRIJ1jX5QoPD-EtYJhC9imCA3PTl1FBkNHQUQeRg';
// 使用相对路径，通过 Vite 代理转发
const BASE_URL = '/anthropic';

// 创建 axios 实例（非流式请求用）
const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY,
    'anthropic-version': '2023-06-01',
    'Authorization': `Bearer ${API_KEY}`,
  },
  timeout: 180000, // 3分钟
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

// 流式回调类型
export type StreamingCallback = (chunk: string, isThinking: boolean) => void;

/**
 * 流式调用大模型 - 基于 Fetch API 实现真正的流式响应
 */
export async function streamChatCompletion(
  messages: ChatMessage[],
  onChunk?: StreamingCallback,
  onThinking?: (thinking: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const anthropicMessages = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

  const systemMessage = messages.find(m => m.role === 'system');

  const requestData: AnthropicRequest = {
    model: 'MiniMax-M2.7',
    max_tokens: 8192,
    system: systemMessage?.content,
    messages: anthropicMessages,
    stream: true,
  };

  try {
    const response = await fetch(`${BASE_URL}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(requestData),
      signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`API Error ${response.status}: ${errorData.base_resp?.status_msg || response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';

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

            // 处理 content_block_start
            if (data.type === 'content_block_start') {
              if (data.content_block?.type === 'thinking') {
                onChunk?.('[思考中...]', true);
              }
            }
            // 处理 delta
            else if (data.type === 'content_block_delta') {
              if (data.delta?.type === 'thinking_delta' && data.delta?.thinking) {
                onThinking?.(data.delta.thinking);
                onChunk?.(data.delta.thinking, true);
              } else if (data.delta?.type === 'text_delta' && data.delta?.text) {
                onChunk?.(data.delta.text, false);
                fullContent += data.delta.text;
              }
            }
            // 处理 message delta (结束)
            else if (data.type === 'message_delta' && data.delta?.stop_sequence) {
              break;
            }
          } catch (e) {
            // 忽略解析错误，继续处理下一行
          }
        }
      }
    }

    return fullContent || '[无内容返回]';

  } catch (error: any) {
    console.error('Stream API call failed:', error);
    throw error;
  }
}

/**
 * 调用大模型进行对话（非流式，兼容旧代码）
 */
export async function chatCompletion(
  messages: ChatMessage[]
): Promise<string> {
  let lastError: any = null;

  // 最多重试3次
  for (let attempt = 1; attempt <= 3; attempt++) {
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
        max_tokens: 8192,
        system: systemMessage?.content,
        messages: anthropicMessages,
        stream: false,
      };

      console.log(`[API Attempt ${attempt}] Sending request...`);
      const response = await apiClient.post('/v1/messages', requestData);

      console.log('[API Response Raw]:', JSON.stringify(response.data, null, 2).substring(0, 500));

      const result = response.data;

      // 检查错误响应
      if (result.error) {
        throw new Error(`API Error: ${result.error.type} - ${result.error.message}`);
      }

      // 检查 base_resp 错误
      if (result.base_resp && result.base_resp.status_code !== 0) {
        throw new Error(`API Error ${result.base_resp.status_code}: ${result.base_resp.status_msg}`);
      }

      // Anthropic API 响应格式 - 处理 content 数组
      if (result.content && Array.isArray(result.content)) {
        const textParts: string[] = [];

        for (const block of result.content) {
          if (block.type === 'text' && block.text) {
            textParts.push(block.text);
          } else if (block.type === 'thinking' && block.thinking) {
            console.log('[Thinking]:', block.thinking.substring(0, 100) + '...');
          }
        }

        if (textParts.length > 0) {
          return textParts.join('\n\n');
        }
      }

      if (result.response) {
        return result.response;
      }

      throw new Error(`Invalid response format, no content found: ${JSON.stringify(result).substring(0, 200)}`);

    } catch (error: any) {
      console.error(`[API Attempt ${attempt} Failed]:`, error.message);
      lastError = error;

      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }

      throw error;
    }
  }

  throw lastError || new Error('API call failed after 3 attempts');
}

export default apiClient;