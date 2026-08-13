import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth';
import { isKVConnected, getSettings } from '@/lib/settings';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthenticated(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const kv = isKVConnected();
  const settings = await getSettings();

  let kvTestOk = false;
  if (kv) {
    try {
      const { Redis } = await import('@upstash/redis');
      const redis = new Redis({
        url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN!,
      });
      await redis.ping();
      kvTestOk = true;
    } catch {
      kvTestOk = false;
    }
  }

  return NextResponse.json({
    kvConnected: kv,
    kvPingOk: kvTestOk,
    hasSessionCookie: !!settings.sessionCookie,
    hasAccessToken: !!settings.accessToken,
    hasApiKey: !!settings.apiAccessKey,
    envVars: {
      hasJwtSecret: !!process.env.JWT_SECRET && process.env.JWT_SECRET !== 'change-me-to-a-random-secret',
      hasAdminPassword: !!process.env.ADMIN_PASSWORD || !!process.env.ADMIN_PASSWORD_HASH,
      hasCronSecret: !!process.env.CRON_SECRET,
    },
  });
}
