import { getSettings, updateSettings } from './settings';
import { ChatPayload, OpenAIMessage } from './types';
import { randomUUID } from 'crypto';

export async function getAccessToken(): Promise<string | null> {
  const settings = await getSettings();
  if (settings.accessToken) return settings.accessToken;
  const refreshed = await refreshAccessToken();
  return refreshed;
}

export async function refreshAccessToken(): Promise<string | null> {
  const settings = await getSettings();
  if (!settings.sessionCookie) return null;
  try {
    const res = await fetch('https://chatgpt.com/api/auth/session', {
      headers: {
        'Cookie': settings.sessionCookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.accessToken) {
      await updateSettings({ accessToken: data.accessToken });
      return data.accessToken;
    }
    return null;
  } catch {
    return null;
  }
}

export function buildPayload(
  messages: OpenAIMessage[],
  conversationId?: string,
  parentMessageId?: string,
  model: string = 'gpt-4o'
): ChatPayload {
  const chatMessages: any[] = [];
  let lastUserMessageId = '';
  let lastAssistantMessageId = '';

  for (const msg of messages) {
    const role = msg.role === 'assistant' ? 'assistant' : 'user';
    const id = randomUUID();
    chatMessages.push({
      id,
      author: { role },
      content: { content_type: 'text', parts: [msg.content] },
    });
    if (role === 'user') lastUserMessageId = id;
    if (role === 'assistant') lastAssistantMessageId = id;
  }

  return {
    action: 'next',
    messages: chatMessages,
    parent_message_id: parentMessageId || lastAssistantMessageId || lastUserMessageId,
    model,
    conversation_id: conversationId || undefined,
    timezone_offset_min: new Date().getTimezoneOffset(),
    history_and_training_disabled: false,
    force_paragen: false,
    suggestions: [],
  };
}

export function extractReply(data: any): string {
  try {
    if (data.message?.content?.parts) {
      return data.message.content.parts.join('\n').trim();
    }
    if (typeof data.message === 'string') return data.message;
  } catch {}
  return '';
}

export async function sendChatRequest(
  messages: OpenAIMessage[],
  conversationId?: string,
  parentMessageId?: string,
  model?: string
): Promise<{ reply: string; conversationId: string; parentMessageId: string }> {
  const settings = await getSettings();
  const effectiveModel = model || settings.defaultModel;
  const accessToken = (await getAccessToken()) || '';
  if (!accessToken) throw new Error('لا يوجد توكن صالح. حدّث الجلسة.');

  const payload = buildPayload(messages, conversationId, parentMessageId, effectiveModel);
  const response = await fetch('https://chatgpt.com/backend-api/conversation', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'Cookie': settings.sessionCookie,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://chatgpt.com/',
      'Origin': 'https://chatgpt.com',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ChatGPT API error: ${response.status} ${errorText}`);
  }

  const text = await response.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    // قد يكون SSE
    const lines = text.split('\n');
    let lastData = '';
    for (const line of lines) {
      if (line.startsWith('data:')) lastData += line.slice(5).trim();
    }
    data = JSON.parse(lastData);
  }

  const reply = extractReply(data);
  return {
    reply,
    conversationId: data.conversation_id || conversationId || '',
    parentMessageId: data.message?.id || payload.parent_message_id,
  };
}
