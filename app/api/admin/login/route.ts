import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminPassword } from '@/lib/settings';
import { signAdminToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  if (!password) return NextResponse.json({ error: 'Password required' }, { status: 400 });

  const isValid = await verifyAdminPassword(password);
  if (!isValid) return NextResponse.json({ error: 'Invalid password' }, { status: 401 });

  const token = await signAdminToken();
  const response = NextResponse.json({ success: true });
  response.cookies.set('admin_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24, // 1 يوم
  });
  return response;
}
