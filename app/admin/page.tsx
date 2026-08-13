'use client';

import { useEffect, useState } from 'react';

interface Settings {
  sessionCookie: string;
  accessToken?: string;
  apiAccessKey?: string;
  defaultModel: string;
  rateLimitMaxRequests: number;
  rateLimitWindow: string;
}

interface StatusInfo {
  kvConnected: boolean;
  kvPingOk: boolean;
  hasSessionCookie: boolean;
  hasAccessToken: boolean;
  hasApiKey: boolean;
  envVars: {
    hasJwtSecret: boolean;
    hasAdminPassword: boolean;
    hasCronSecret: boolean;
  };
}

export default function AdminPage() {
  const [settings, setSettings] = useState<Settings>({
    sessionCookie: '',
    accessToken: '',
    apiAccessKey: '',
    defaultModel: 'gpt-4o',
    rateLimitMaxRequests: 10,
    rateLimitWindow: '1 m',
  });
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
  const [status, setStatus] = useState<StatusInfo | null>(null);
  const [checkingToken, setCheckingToken] = useState(false);

  const showMsg = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage(msg);
    setMessageType(type);
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [settingsRes, statusRes] = await Promise.all([
        fetch('/api/admin/settings'),
        fetch('/api/admin/status'),
      ]);

      if (!settingsRes.ok) throw new Error('Unauthorized');

      const settingsData = await settingsRes.json();
      setSettings(settingsData);

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setStatus(statusData);
      }
    } catch {
      showMsg('فشل تحميل الإعدادات أو انتهت الجلسة', 'error');
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setSettings((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    showMsg('جاري الحفظ...', 'info');
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...settings, newAdminPassword }),
      });
      if (res.ok) {
        showMsg('✅ تم الحفظ بنجاح', 'success');
        setNewAdminPassword('');
        loadData();
      } else {
        const data = await res.json().catch(() => ({}));
        showMsg('❌ ' + (data.error || 'حدث خطأ أثناء الحفظ'), 'error');
      }
    } catch {
      showMsg('❌ فشل الاتصال', 'error');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  const handleRefreshToken = async () => {
    setCheckingToken(true);
    showMsg('جاري تحديث التوكن...', 'info');
    try {
      const res = await fetch('/api/session', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        showMsg('✅ تم تحديث التوكن بنجاح', 'success');
        loadData();
      } else {
        showMsg('❌ فشل تحديث التوكن - تأكد من صحة كوكي الجلسة', 'error');
      }
    } catch {
      showMsg('❌ فشل الاتصال', 'error');
    }
    setCheckingToken(false);
  };

  const msgColor =
    messageType === 'success' ? '#16a34a' : messageType === 'error' ? '#dc2626' : '#2563eb';

  return (
    <div style={{ maxWidth: 900, margin: '20px auto', padding: 20 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
          backgroundColor: 'white',
          padding: 20,
          borderRadius: 12,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1a1a1a' }}>⚙️ لوحة الإدارة</h1>
          <p style={{ fontSize: 13, color: '#666', marginTop: 4 }}>تحكم في إعدادات الوكيل والجلسات</p>
        </div>
        <button
          onClick={handleLogout}
          style={{
            padding: '8px 16px',
            backgroundColor: '#fef2f2',
            color: '#dc2626',
            border: '1px solid #fecaca',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          🚪 تسجيل الخروج
        </button>
      </div>

      {/* Status Dashboard */}
      {status && (
        <div
          style={{
            backgroundColor: 'white',
            padding: 20,
            borderRadius: 12,
            marginBottom: 20,
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 15, color: '#1a1a1a' }}>
            📊 حالة النظام
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 12,
            }}
          >
            {/* KV Status */}
            <div
              style={{
                padding: 12,
                borderRadius: 8,
                border: '1px solid',
                borderColor: status.kvConnected && status.kvPingOk ? '#bbf7d0' : '#fecaca',
                backgroundColor: status.kvConnected && status.kvPingOk ? '#f0fdf4' : '#fef2f2',
              }}
            >
              <div style={{ fontSize: 22 }}>{status.kvConnected && status.kvPingOk ? '🟢' : '🔴'}</div>
              <div style={{ fontWeight: 600, fontSize: 13, marginTop: 4 }}>قاعدة البيانات (KV)</div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                {status.kvConnected && status.kvPingOk
                  ? 'متصلة بـ Upstash Redis'
                  : 'غير متصلة - تعمل بالذاكرة'}
              </div>
            </div>

            {/* Session Cookie */}
            <div
              style={{
                padding: 12,
                borderRadius: 8,
                border: '1px solid',
                borderColor: status.hasSessionCookie ? '#bbf7d0' : '#fef3c7',
                backgroundColor: status.hasSessionCookie ? '#f0fdf4' : '#fffbeb',
              }}
            >
              <div style={{ fontSize: 22 }}>{status.hasSessionCookie ? '🟢' : '🟡'}</div>
              <div style={{ fontWeight: 600, fontSize: 13, marginTop: 4 }}>كوكي الجلسة</div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                {status.hasSessionCookie ? 'تم ضبطه' : 'غير مضبوط'}
              </div>
            </div>

            {/* Access Token */}
            <div
              style={{
                padding: 12,
                borderRadius: 8,
                border: '1px solid',
                borderColor: status.hasAccessToken ? '#bbf7d0' : '#fef3c7',
                backgroundColor: status.hasAccessToken ? '#f0fdf4' : '#fffbeb',
              }}
            >
              <div style={{ fontSize: 22 }}>{status.hasAccessToken ? '🟢' : '🟡'}</div>
              <div style={{ fontWeight: 600, fontSize: 13, marginTop: 4 }}>Access Token</div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                {status.hasAccessToken ? 'جاهز' : 'سيتم توليده تلقائياً'}
              </div>
            </div>

            {/* JWT Secret */}
            <div
              style={{
                padding: 12,
                borderRadius: 8,
                border: '1px solid',
                borderColor: status.envVars.hasJwtSecret ? '#bbf7d0' : '#fecaca',
                backgroundColor: status.envVars.hasJwtSecret ? '#f0fdf4' : '#fef2f2',
              }}
            >
              <div style={{ fontSize: 22 }}>{status.envVars.hasJwtSecret ? '🟢' : '🔴'}</div>
              <div style={{ fontWeight: 600, fontSize: 13, marginTop: 4 }}>JWT Secret</div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                {status.envVars.hasJwtSecret ? 'آمن' : 'يجب تغيير القيمة الافتراضية'}
              </div>
            </div>
          </div>

          {/* KV not connected warning */}
          {!status.kvPingOk && (
            <div
              style={{
                marginTop: 15,
                padding: 14,
                backgroundColor: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: 8,
                fontSize: 13,
                lineHeight: 1.7,
              }}
            >
              <div style={{ fontWeight: 600, color: '#92400e', marginBottom: 6 }}>
                ⚠️ قاعدة البيانات غير مربوطة
              </div>
              <p style={{ color: '#78350f' }}>
                التطبيق يعمل حالياً بالتخزين المؤقت في الذاكرة. الإعدادات ستفقد عند إعادة تشغيل
                الخادم. لحفظ دائم:
              </p>
              <ol style={{ marginTop: 8, paddingRight: 20, color: '#78350f' }}>
                <li>اذهب إلى مشروعك في Vercel → <b>Storage</b> (أعلى الصفحة)</li>
                <li>اضغط <b>Create Database</b> واختر <b>Upstash Redis (KV compatible)</b></li>
                <li>اختر الفئة المجانية (Free) واضغط Create</li>
                <li>اربطه بالمشروع ثم أعد النشر (Redeploy)</li>
              </ol>
              <p style={{ marginTop: 8, color: '#78350f', fontSize: 12 }}>
                بعد الربط، ستظهر متغيرات <code style={{ background: '#fef3c7', padding: '1px 4px', borderRadius: 3 }}>KV_REST_API_URL</code> و
                <code style={{ background: '#fef3c7', padding: '1px 4px', borderRadius: 3 }}> KV_REST_API_TOKEN</code> تلقائياً في Environment Variables.
              </p>
            </div>
          )}

          {/* JWT warning */}
          {!status.envVars.hasJwtSecret && (
            <div
              style={{
                marginTop: 10,
                padding: 12,
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 8,
                fontSize: 13,
                color: '#991b1b',
              }}
            >
              ⚠️ JWT_SECRET لا يزال على القيمة الافتراضية! غيّره من Vercel → Settings → Environment
              Variables لضمان الأمان.
            </div>
          )}
        </div>
      )}

      {/* Message */}
      {message && (
        <div
          style={{
            padding: 12,
            marginBottom: 15,
            borderRadius: 8,
            backgroundColor: msgColor + '15',
            border: '1px solid ' + msgColor + '40',
            color: msgColor,
            fontSize: 14,
          }}
        >
          {message}
        </div>
      )}

      {/* Settings Form */}
      <form
        onSubmit={handleSubmit}
        style={{
          backgroundColor: 'white',
          padding: 20,
          borderRadius: 12,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20, color: '#1a1a1a' }}>
          🔧 الإعدادات
        </h2>

        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>
            🍪 كوكي الجلسة (Session Cookie)
            <span style={{ color: '#dc2626', marginRight: 4 }}>*</span>
          </label>
          <textarea
            name="sessionCookie"
            value={settings.sessionCookie}
            onChange={handleChange}
            rows={3}
            placeholder="الصق كوكي ChatGPT هنا..."
            dir="ltr"
            style={{
              width: '100%',
              padding: 10,
              borderRadius: 8,
              border: '1px solid #d1d5db',
              fontSize: 13,
              fontFamily: 'monospace',
              resize: 'vertical',
              outline: 'none',
            }}
          />
          <p style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
            طريقة الحصول: سجّل دخولك إلى chatgpt.com → افتح أدوات المطور (F12) → Application → Cookies
            → انسخ قيمة cookie بالكامل
          </p>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>
            🎫 Access Token (اختياري)
          </label>
          <textarea
            name="accessToken"
            value={settings.accessToken || ''}
            onChange={handleChange}
            rows={2}
            placeholder="سيتم توليده تلقائياً من الكوكي..."
            dir="ltr"
            style={{
              width: '100%',
              padding: 10,
              borderRadius: 8,
              border: '1px solid #d1d5db',
              fontSize: 13,
              fontFamily: 'monospace',
              resize: 'vertical',
              outline: 'none',
            }}
          />
          <p style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
            لا داعي لإدخاله يدوياً، اضغط الزر أدناه لتحديثه تلقائياً من الكوكي.
          </p>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>
            🔑 مفتاح API للحماية (اختياري)
          </label>
          <input
            type="text"
            name="apiAccessKey"
            value={settings.apiAccessKey || ''}
            onChange={handleChange}
            placeholder="اتركه فارغاً للسماح للجميع باستخدام الواجهة"
            dir="ltr"
            style={{
              width: '100%',
              padding: 10,
              borderRadius: 8,
              border: '1px solid #d1d5db',
              fontSize: 14,
              outline: 'none',
            }}
          />
          <p style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
            إذا ضبطته، يجب إرساله في Header <code style={{ fontSize: 11 }}>x-api-key</code> لاستخدام الـ API.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 15, marginBottom: 18 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>
              🤖 النموذج الافتراضي
            </label>
            <select
              name="defaultModel"
              value={settings.defaultModel}
              onChange={handleChange}
              style={{
                width: '100%',
                padding: 10,
                borderRadius: 8,
                border: '1px solid #d1d5db',
                fontSize: 14,
                outline: 'none',
                backgroundColor: 'white',
              }}
            >
              <option value="gpt-4o">GPT-4o (الأحدث)</option>
              <option value="gpt-4o-mini">GPT-4o Mini (سريع)</option>
              <option value="gpt-4">GPT-4</option>
              <option value="text-davinci-002-render-sha">GPT-3.5 Legacy</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>
              ⏱ أقصى طلبات/الدقيقة
            </label>
            <input
              type="number"
              name="rateLimitMaxRequests"
              value={settings.rateLimitMaxRequests}
              onChange={handleChange}
              min={1}
              style={{
                width: '100%',
                padding: 10,
                borderRadius: 8,
                border: '1px solid #d1d5db',
                fontSize: 14,
                outline: 'none',
              }}
            />
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>
            🔒 كلمة مرور جديدة للإدارة
          </label>
          <input
            type="password"
            value={newAdminPassword}
            onChange={(e) => setNewAdminPassword(e.target.value)}
            placeholder="اتركها فارغة لعدم التغيير"
            style={{
              width: '100%',
              padding: 10,
              borderRadius: 8,
              border: '1px solid #d1d5db',
              fontSize: 14,
              outline: 'none',
            }}
          />
          <p style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
            سيتم تشفيرها (hashed) وحفظها في قاعدة البيانات.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="submit"
            style={{
              padding: '10px 24px',
              backgroundColor: '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 600,
            }}
          >
            💾 حفظ الإعدادات
          </button>

          <button
            type="button"
            onClick={handleRefreshToken}
            disabled={checkingToken}
            style={{
              padding: '10px 20px',
              backgroundColor: checkingToken ? '#9ca3af' : '#16a34a',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 600,
              cursor: checkingToken ? 'not-allowed' : 'pointer',
            }}
          >
            {checkingToken ? '⏳ جاري التحديث...' : '🔄 تحديث Access Token'}
          </button>

          <a
            href="/"
            style={{
              padding: '10px 20px',
              backgroundColor: '#f3f4f6',
              color: '#333',
              border: '1px solid #d1d5db',
              borderRadius: 8,
              fontSize: 15,
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            ← العودة للواجهة
          </a>
        </div>
      </form>

      {/* Instructions */}
      <div
        style={{
          marginTop: 20,
          padding: 16,
          backgroundColor: '#f9fafb',
          borderRadius: 12,
          fontSize: 13,
          color: '#666',
          lineHeight: 1.8,
        }}
      >
        <h3 style={{ fontWeight: 600, color: '#333', marginBottom: 8 }}>📝 ملاحظات سريعة:</h3>
        <ul style={{ paddingRight: 18 }}>
          <li>
            عند ربط <b>Upstash Redis (KV)</b> من Vercel Storage، ستُحفظ جميع الإعدادات دائماً وستبقى
            بين عمليات إعادة النشر.
          </li>
          <li>
            كلمة المرور الافتراضية للإدارة عند أول استخدام (بدون ضبط أي متغير) هي:
            <code style={{ background: '#e5e7eb', padding: '2px 8px', borderRadius: 4, marginRight: 4 }}>admin</code>
            <b>يُنصح بتغييرها فوراً</b>.
          </li>
          <li>
            لتفعيل التحديث التلقائي للتوكن كل 6 ساعات، اربطه بـ Cron Job من استضافة Namecheap كما هو
            موضح في ملف CRON_SETUP.md.
          </li>
        </ul>
      </div>
    </div>
  );
}
