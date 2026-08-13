import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

let rateLimiter: Ratelimit | null = null;

// تخزين بسيط في الذاكرة كبديل عندما لا يتوفر Redis
const memoryHits = new Map<string, { count: number; resetAt: number }>();

function getRateLimiter(): Ratelimit | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    if (!rateLimiter) {
      try {
        const redis = new Redis({ url, token });
        rateLimiter = new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(10, '1 m'),
          analytics: true,
        });
      } catch {
        return null;
      }
    }
    return rateLimiter;
  }
  return null;
}

export async function checkRateLimit(identifier: string): Promise<boolean> {
  const limiter = getRateLimiter();
  if (!limiter) {
    // Fallback: rate limiting بسيط في الذاكرة (10 طلبات في الدقيقة)
    const now = Date.now();
    const windowMs = 60 * 1000;
    const maxRequests = 10;

    const entry = memoryHits.get(identifier);
    if (!entry || now > entry.resetAt) {
      memoryHits.set(identifier, { count: 1, resetAt: now + windowMs });
      return true;
    }

    entry.count += 1;
    if (entry.count > maxRequests) {
      return false;
    }
    return true;
  }

  try {
    const { success } = await limiter.limit(identifier);
    return success;
  } catch {
    return true; // عند الفشل، نسمح بالطلب
  }
}
