'use client';

import { useState } from 'react';

interface Conversation {
  reply: string;
  conversation_id: string;
  parent_message_id: string;
}

const EXAMPLES = [
  { icon: '📝', title: 'كتابة مقال', prompt: 'اكتب لي مقالاً قصيراً عن أهمية الذكاء الاصطناعي في التعليم الحديث، بمقدمة وثلاث فقرات وخاتمة.' },
  { icon: '💻', title: 'كود برمجي', prompt: 'اكتب دالة Python تأخذ قائمة أرقام وتُرجع أكبر رقم وأصغر رقم فيها، مع شرح بسيط للكود.' },
  { icon: '🌐', title: 'ترجمة نص', prompt: 'ترجم النص التالي إلى الإنجليزية:\n\n"الذكاء الاصطناعي يُحدث ثورة في كيفية تفاعلنا مع التكنولوجيا، ويفتح آفاقاً جديدة للابتكار في جميع المجالات."' },
  { icon: '📧', title: 'بريد إلكتروني', prompt: 'اكتب رسالة بريد إلكتروني مهنية لطلب إجازة لمدة أسبوع من المدير، مع ذكر تاريخ البدء والعودة، وتعهد بإنجاز المهام العالقة.' },
  { icon: '🍳', title: 'وصفة طبخ', prompt: 'أعطني وصفة سهلة وسريعة لتحضير شوربة العدس بالخضار، مكوناتها وخطواتها بالتفصيل.' },
  { icon: '🧮', title: 'حل مسألة', prompt: 'اشرح لي كيف أحل هذه المسألة خطوة بخطوة: إذا كان ثمن 3 أقلام ودفترين هو 15 دولار، وثمن القلم الواحد هو 2 دولار، فما ثمن الدفتر الواحد؟' },
  { icon: '✍️', title: 'تلخيص نص', prompt: 'لخّص النص التالي في 3 نقاط رئيسية بأسلوب واضح:\n\n"تغير المناخ هو أحد أكبر التحديات التي تواجه البشرية في القرن الحادي والعشرين. يؤدي ارتفاع درجات الحرارة العالمية إلى ذوبان القمم الجليدية، مما يسبب ارتفاع مستوى سطح البحر وتهديد المدن الساحلية. كما يؤثر على أنماط الطقس، مسبباً موجات حر أكثر شدة، وعواصف أقوى، وفترات جفاف أطول. الحلول تتطلب تعاوناً دولياً للحد من انبعاثات الكربون، والاستثمار في الطاقة المتجددة، وحماية الغابات والمسطحات المائية."' },
  { icon: '🎯', title: 'خطة عمل', prompt: 'ضع لي خطة دراسية أسبوعية لتحسين مهاراتي في اللغة الإنجليزية خلال شهر واحد، تشمل الاستماع والمحادثة والقراءة والكتابة.' },
];

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(false);
  const [stream, setStream] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [parentMessageId, setParentMessageId] = useState<string | undefined>();
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);

  const handleExampleClick = (examplePrompt: string) => {
    setPrompt(examplePrompt);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNewChat = () => {
    setReply('');
    setPrompt('');
    setConversationId(undefined);
    setParentMessageId(undefined);
    setMessages([]);
  };

  const handleSubmit = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setReply('');

    const newMessages = [...messages, { role: 'user', content: prompt }];
    setMessages(newMessages);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (apiKey) headers['x-api-key'] = apiKey;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messages: newMessages,
          stream,
          conversation_id: conversationId,
          parent_message_id: parentMessageId,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        setReply('❌ خطأ: ' + (errorData.error || res.status));
        setLoading(false);
        return;
      }

      let fullReply = '';

      if (stream) {
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let done = false;
        while (!done) {
          const { value, done: doneReading } = await reader!.read();
          done = doneReading;
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data:')) {
              const dataStr = line.slice(5).trim();
              if (dataStr === '[DONE]') break;
              try {
                const json = JSON.parse(dataStr);
                if (json.error) {
                  fullReply = '❌ ' + json.error;
                  setReply(fullReply);
                  break;
                }
                if (json.done) {
                  if (json.conversation_id) setConversationId(json.conversation_id);
                  if (json.parent_message_id) setParentMessageId(json.parent_message_id);
                  continue;
                }
                if (json.conversation_id && !conversationId) {
                  setConversationId(json.conversation_id);
                }
                const content = json.choices?.[0]?.delta?.content;
                if (content) {
                  fullReply += content;
                  setReply(fullReply);
                }
                if (json.id && !parentMessageId) {
                  setParentMessageId(json.id);
                }
              } catch {}
            }
          }
        }
      } else {
        const data = await res.json();
        if (data.success) {
          fullReply = data.response;
          setReply(fullReply);
          if (data.conversation_id) setConversationId(data.conversation_id);
          if (data.parent_message_id) setParentMessageId(data.parent_message_id);
        } else {
          setReply('❌ خطأ: ' + data.error);
        }
      }

      if (fullReply) {
        setMessages([...newMessages, { role: 'assistant', content: fullReply }]);
      }
      setPrompt('');
    } catch (err) {
      setReply('❌ فشل الاتصال بالخادم. تأكد من إعداد كوكي الجلسة من لوحة الإدارة.');
    }
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: 20, minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 20, paddingTop: 10 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#1a1a1a', marginBottom: 5 }}>
          🤖 ChatGPT Proxy
        </h1>
        <p style={{ color: '#666', fontSize: 14 }}>واجهة ذكية للتعامل مع ChatGPT عبر Vercel</p>
        {messages.length > 0 && (
          <button
            onClick={handleNewChat}
            style={{
              marginTop: 10,
              padding: '8px 16px',
              backgroundColor: '#f3f4f6',
              color: '#333',
              border: '1px solid #ddd',
              borderRadius: 6,
              fontSize: 14,
            }}
          >
            🆕 محادثة جديدة
          </button>
        )}
      </div>

      {/* Chat History */}
      {messages.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          {messages.map((msg, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-start' : 'flex-end',
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  maxWidth: '85%',
                  padding: '12px 16px',
                  borderRadius: 12,
                  backgroundColor: msg.role === 'user' ? '#0070f3' : '#ffffff',
                  color: msg.role === 'user' ? 'white' : '#333',
                  border: msg.role === 'user' ? 'none' : '1px solid #e5e7eb',
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.6,
                  fontSize: 15,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                }}
              >
                <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 4 }}>
                  {msg.role === 'user' ? '👤 أنت' : '🤖 المساعد'}
                </div>
                {msg.content}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Examples */}
      {messages.length === 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#555', marginBottom: 12, textAlign: 'center' }}>
            💡 أمثلة جاهزة - اضغط لبدء محادثة
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
            {EXAMPLES.map((ex, idx) => (
              <button
                key={idx}
                onClick={() => handleExampleClick(ex.prompt)}
                style={{
                  textAlign: 'right',
                  padding: '14px',
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: 10,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  lineHeight: 1.4,
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = '#0070f3';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,112,243,0.15)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = '#e5e7eb';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ fontSize: 22, marginBottom: 6 }}>{ex.icon}</div>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#1a1a1a', marginBottom: 4 }}>{ex.title}</div>
                <div style={{ fontSize: 12, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {ex.prompt.split('\n')[0]}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div
        style={{
          position: messages.length > 0 ? 'sticky' : 'relative',
          bottom: 0,
          backgroundColor: '#f5f5f5',
          padding: messages.length > 0 ? '15px 0' : '0',
          zIndex: 10,
        }}
      >
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: 12,
            border: '1px solid #d1d5db',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            overflow: 'hidden',
          }}
        >
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={messages.length > 0 ? 2 : 4}
            placeholder="اكتب رسالتك هنا... (اضغط Enter للإرسال، Shift+Enter لسطر جديد)"
            style={{
              width: '100%',
              padding: 14,
              fontSize: 15,
              border: 'none',
              outline: 'none',
              resize: 'none',
              borderRadius: 0,
              backgroundColor: 'transparent',
            }}
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              borderTop: '1px solid #f0f0f0',
              backgroundColor: '#fafafa',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#555', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={stream}
                  onChange={(e) => setStream(e.target.checked)}
                />
                ⚡ بث مباشر
              </label>
              <input
                type="text"
                placeholder="🔑 API Key (اختياري)"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: '1px solid #d1d5db',
                  fontSize: 13,
                  width: 160,
                  outline: 'none',
                }}
              />
            </div>
            <button
              onClick={handleSubmit}
              disabled={loading || !prompt.trim()}
              style={{
                padding: '8px 24px',
                fontSize: 15,
                fontWeight: 600,
                backgroundColor: loading || !prompt.trim() ? '#9ca3af' : '#0070f3',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                cursor: loading || !prompt.trim() ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s',
              }}
            >
              {loading ? '⏳ جارٍ التفكير...' : 'إرسال ↵'}
            </button>
          </div>
        </div>

        {/* Loading indicator */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 10, color: '#0070f3', fontSize: 14 }}>
            <span style={{ animation: 'pulse-dot 1.5s ease-in-out infinite', display: 'inline-block' }}>●</span> جاري إنشاء الرد...
          </div>
        )}

        {/* Reply area for non-streaming or initial */}
        {reply && messages.length === 0 && (
          <div
            style={{
              marginTop: 15,
              whiteSpace: 'pre-wrap',
              border: '1px solid #e5e7eb',
              padding: 16,
              borderRadius: 12,
              backgroundColor: 'white',
              lineHeight: 1.7,
              fontSize: 15,
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}
          >
            {reply}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 12, color: '#999' }}>
        مبني بـ Next.js على Vercel | نموذج: GPT-4o | <a href="/login" style={{ color: '#0070f3', textDecoration: 'none' }}>لوحة الإدارة</a>
      </div>

      
    </main>
  );
}
