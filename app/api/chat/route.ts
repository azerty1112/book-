import { NextRequest, NextResponse } from 'next/server';
import { sendChatRequest, getAccessToken, refreshAccessToken, buildPayload, extractReply } from '@/lib/chatgpt';
import { OpenAIMessage } from '@/lib/types';
import { getSettings } from '@/lib/settings';
import { checkRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  // Rate limiting بسيط (اختياري)
  const ip = req.ip ?? 'anonymous';
  const allowed = await checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  // التحقق من API Key (اختياري)
  const apiKeyFromHeader = req.headers.get('x-api-key');
  const settings = await getSettings();
  if (settings.apiAccessKey && apiKeyFromHeader !== settings.apiAccessKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  let messages: OpenAIMessage[] = [];
  let stream = false;
  let model = settings.defaultModel;
  let conversationId: string | undefined;
  let parentMessageId: string | undefined;

  if (body.messages && Array.isArray(body.messages)) {
    messages = body.messages;
    stream = body.stream === true;
    model = body.model || settings.defaultModel;
    conversationId = body.conversation_id;
    parentMessageId = body.parent_message_id;
  } else if (body.prompt) {
    messages = [{ role: 'user', content: body.prompt }];
    stream = body.stream === true;
    model = body.model || settings.defaultModel;
    conversationId = body.conversation_id;
    parentMessageId = body.parent_message_id;
  } else {
    return NextResponse.json({ error: 'messages or prompt required' }, { status: 400 });
  }

  if (stream) {
    return handleStream(messages, conversationId, parentMessageId, model);
  }

  try {
    const { reply, conversationId: newConvId, parentMessageId: newParentId } = await sendChatRequest(
      messages,
      conversationId,
      parentMessageId,
      model
    );
    return NextResponse.json({
      success: true,
      response: reply,
      conversation_id: newConvId,
      parent_message_id: newParentId,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

async function handleStream(
  messages: OpenAIMessage[],
  conversationId?: string,
  parentMessageId?: string,
  model: string = 'gpt-4o'
): Promise<NextResponse> {
  const encoder = new TextEncoder();
  let capturedConversationId = conversationId || '';
  let capturedMessageId = '';
  let lastText = '';

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const settings = await getSettings();
        let accessToken = await getAccessToken();
        if (!accessToken) accessToken = await refreshAccessToken();
        if (!accessToken) throw new Error('لا يوجد توكن');

        const payload = buildPayload(messages, conversationId, parentMessageId, model);
        const response = await fetch('https://chatgpt.com/backend-api/conversation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'Cookie': settings.sessionCookie,
            'Accept': 'text/event-stream',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://chatgpt.com/',
            'Origin': 'https://chatgpt.com',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errBody = await response.text();
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: `ChatGPT error: ${response.status} ${errBody.slice(0, 200)}` })}\n\n`));
          controller.close();
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          controller.error(new Error('No reader'));
          return;
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data:')) {
              const data = line.slice(5).trim();
              if (data === '[DONE]') {
                // إرسال رسالة ختامية تحتوي على المعرّفات لاستمرار المحادثة
                const finalMeta = JSON.stringify({
                  done: true,
                  conversation_id: capturedConversationId,
                  parent_message_id: capturedMessageId,
                });
                controller.enqueue(encoder.encode(`data: ${finalMeta}\n\n`));
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                controller.close();
                return;
              }
              try {
                const json = JSON.parse(data);
                const text = extractReply(json);
                if (json.conversation_id) capturedConversationId = json.conversation_id;
                if (json.message?.id) capturedMessageId = json.message.id;
                if (text && text !== lastText) {
                  lastText = text;
                  const sseData = JSON.stringify({
                    id: json.message?.id || '',
                    object: 'chat.completion.chunk',
                    created: Date.now(),
                    model,
                    conversation_id: capturedConversationId,
                    choices: [{ delta: { content: text }, index: 0 }],
                  });
                  controller.enqueue(encoder.encode(`data: ${sseData}\n\n`));
                }
              } catch {
                // تجاهل الأسطر غير الصالحة
              }
            }
          }
        }

        // في حالة انتهاء الـ stream بدون [DONE]
        const finalMeta = JSON.stringify({
          done: true,
          conversation_id: capturedConversationId,
          parent_message_id: capturedMessageId,
        });
        controller.enqueue(encoder.encode(`data: ${finalMeta}\n\n`));
        controller.close();
      } catch (error: any) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: error.message || 'Stream error' })}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
