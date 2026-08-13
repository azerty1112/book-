import { Redis } from '@upstash/redis';
import bcrypt from 'bcryptjs';

export interface AppSettings {
  sessionCookie: string;
  accessToken?: string;
  apiAccessKey?: string;
  adminPasswordHash?: string;
  defaultModel: string;
  rateLimitMaxRequests: number;
  rateLimitWindow: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  sessionCookie: '',
  accessToken: '',
  apiAccessKey: process.env.API_ACCESS_KEY || '',
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH || '',
  defaultModel: 'gpt-4o',
  rateLimitMaxRequests: 10,
  rateLimitWindow: '1 m',
};

const SETTINGS_KEY = 'app_settings';

// ─── تخزين احتياطي في الذاكرة ─────────────────────────────────────
// يُستخدم تلقائياً عند عدم توفر Redis/KV (مثلاً أثناء التطوير أو قبل ربط KV)
let memoryStore: Record<string, any> = {};

function getRedis(): Redis | null {
  // الأولوية: KV_REST_API_URL (من Vercel KV/Upstash integration)
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    try {
      return new Redis({ url, token });
    } catch {
      return null;
    }
  }
  return null;
}

export function isKVConnected(): boolean {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return !!(url && token);
}

export async function getSettings(): Promise<AppSettings> {
  // قراءة من متغيرات البيئة أولاً
  let settings = { ...DEFAULT_SETTINGS };

  if (process.env.CHATGPT_SESSION_COOKIE) {
    settings.sessionCookie = process.env.CHATGPT_SESSION_COOKIE;
  }
  if (process.env.CHATGPT_ACCESS_TOKEN) {
    settings.accessToken = process.env.CHATGPT_ACCESS_TOKEN;
  }

  const redis = getRedis();

  if (redis) {
    try {
      const stored = await redis.get<AppSettings>(SETTINGS_KEY);
      if (stored) {
        settings = { ...settings, ...stored };
      }
      return settings;
    } catch (error) {
      console.warn('Redis unavailable, falling back to memory store:', error);
    }
  }

  // Fallback: الذاكرة
  if (memoryStore[SETTINGS_KEY]) {
    settings = { ...settings, ...memoryStore[SETTINGS_KEY] };
  }

  return settings;
}

export async function updateSettings(newSettings: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings();
  const updated = { ...current, ...newSettings };

  const redis = getRedis();

  if (redis) {
    try {
      await redis.set(SETTINGS_KEY, updated);
    } catch (error) {
      console.warn('Redis write failed, using memory store:', error);
      memoryStore[SETTINGS_KEY] = updated;
    }
  } else {
    // حفظ في الذاكرة إذا لم يكن Redis متوفراً
    memoryStore[SETTINGS_KEY] = updated;
  }

  return updated;
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
  const settings = await getSettings();
  if (!settings.adminPasswordHash) {
    // إذا لم يوجد hash، تحقق من كلمة المرور المباشرة من متغير البيئة إن وجد
    const envPassword = process.env.ADMIN_PASSWORD;
    if (envPassword) {
      return password === envPassword;
    }
    // في حالة عدم تعيين أي كلمة مرور على الإطلاق، السماح بأول دخول بكلمة "admin"
    if (!envPassword && !memoryStore[SETTINGS_KEY]?.adminPasswordHash) {
      return password === 'admin';
    }
    return false;
  }
  return bcrypt.compare(password, settings.adminPasswordHash);
}
