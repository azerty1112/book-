'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.push('/admin');
      } else {
        setError('كلمة المرور غير صحيحة');
      }
    } catch {
      setError('فشل الاتصال');
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '100px auto', padding: 20, backgroundColor: 'white', borderRadius: 8 }}>
      <h1 style={{ textAlign: 'center' }}>تسجيل الدخول للإدارة</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="كلمة المرور"
          style={{ width: '100%', padding: 10, margin: '20px 0', borderRadius: 4, border: '1px solid #ccc' }}
          required
        />
        <button
          type="submit"
          style={{
            width: '100%',
            padding: 10,
            backgroundColor: '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            fontSize: 16,
          }}
        >
          دخول
        </button>
        {error && <p style={{ color: 'red', marginTop: 10 }}>{error}</p>}
      </form>
    </div>
  );
}
