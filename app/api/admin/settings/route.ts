import { NextRequest, NextResponse } from 'next/server';
import { getSettings, updateSettings } from '@/lib/settings';
import { isAdminAuthenticated } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthenticated(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const settings = await getSettings();
  const publicSettings = {
    sessionCookie: settings.sessionCookie,
    accessToken: settings.accessToken,
    apiAccessKey: settings.apiAccessKey,
    defaultModel: settings.defaultModel,
    rateLimitMaxRequests: settings.rateLimitMaxRequests,
    rateLimitWindow: settings.rateLimitWindow,
  };
  return NextResponse.json(publicSettings);
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const {
    sessionCookie,
    accessToken,
    apiAccessKey,
    defaultModel,
    rateLimitMaxRequests,
    rateLimitWindow,
    newAdminPassword,
  } = body;

  const updateData: any = {};
  if (sessionCookie !== undefined) updateData.sessionCookie = sessionCookie;
  if (accessToken !== undefined) updateData.accessToken = accessToken;
  if (apiAccessKey !== undefined) updateData.apiAccessKey = apiAccessKey;
  if (defaultModel) updateData.defaultModel = defaultModel;
  if (rateLimitMaxRequests) updateData.rateLimitMaxRequests = Number(rateLimitMaxRequests);
  if (rateLimitWindow) updateData.rateLimitWindow = rateLimitWindow;

  if (newAdminPassword) {
    const salt = await bcrypt.genSalt(10);
    updateData.adminPasswordHash = await bcrypt.hash(newAdminPassword, salt);
  }

  await updateSettings(updateData);
  return NextResponse.json({ success: true });
}
