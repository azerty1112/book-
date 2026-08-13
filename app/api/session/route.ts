import { NextRequest, NextResponse } from 'next/server';
import { refreshAccessToken, getAccessToken } from '@/lib/chatgpt';

export async function GET(req: NextRequest) {
  const token = await getAccessToken();
  return NextResponse.json({ accessToken: token ? 'present' : null });
}

export async function POST(req: NextRequest) {
  const newToken = await refreshAccessToken();
  if (newToken) {
    return NextResponse.json({ success: true, message: 'Token refreshed' });
  }
  return NextResponse.json({ success: false, error: 'Failed to refresh token' }, { status: 500 });
}
