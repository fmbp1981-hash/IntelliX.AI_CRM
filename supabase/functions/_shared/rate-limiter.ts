/**
 * Rate Limiter for Edge Functions
 * T011: Implementa rate limiting usando tabela Supabase
 * 
 * Design:
 * - Usa tabela rate_limits no Supabase
 * - Janela deslizante de 1 minuto
 * - Limites configuráveis por endpoint
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface RateLimitConfig {
  /** Requests allowed per window */
  limit: number;
  /** Window size in seconds (default: 60) */
  windowSeconds?: number;
  /** Identifier for the endpoint */
  endpoint: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number;
}

// Default limits per endpoint
export const RATE_LIMITS: Record<string, number> = {
  'setup-instance': 3,      // Very strict - only needed once
  'create-user': 10,        // Admin action
  'delete-user': 5,         // Admin action, dangerous
  'list-users': 30,         // Read operation
  'invite-users': 10,       // Can trigger emails
  'accept-invite': 10,      // Auth related
  'ai-proxy': 20,           // AI calls are expensive
  'default': 60,            // Default limit
};

/**
 * Check rate limit for a given identifier
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const windowSeconds = config.windowSeconds ?? 60;
  const limit = config.limit;
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowSeconds * 1000);

  try {
    // Count requests in current window
    const { count, error: countError } = await supabase
      .from('rate_limits')
      .select('*', { count: 'exact', head: true })
      .eq('identifier', identifier)
      .eq('endpoint', config.endpoint)
      .gte('created_at', windowStart.toISOString());

    if (countError) {
      console.error('Rate limit count error:', countError);
      // Fail open - allow request but log error
      return {
        allowed: true,
        remaining: limit,
        resetAt: new Date(now.getTime() + windowSeconds * 1000),
      };
    }

    const currentCount = count ?? 0;
    const remaining = Math.max(0, limit - currentCount);
    const resetAt = new Date(now.getTime() + windowSeconds * 1000);

    if (currentCount >= limit) {
      // Calculate retry-after
      const { data: oldestRecord } = await supabase
        .from('rate_limits')
        .select('created_at')
        .eq('identifier', identifier)
        .eq('endpoint', config.endpoint)
        .gte('created_at', windowStart.toISOString())
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      const retryAfter = oldestRecord
        ? Math.ceil(
            (new Date(oldestRecord.created_at).getTime() + windowSeconds * 1000 - now.getTime()) / 1000
          )
        : windowSeconds;

      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter: Math.max(1, retryAfter),
      };
    }

    // Record this request
    const { error: insertError } = await supabase
      .from('rate_limits')
      .insert({
        identifier,
        endpoint: config.endpoint,
        created_at: now.toISOString(),
      });

    if (insertError) {
      console.error('Rate limit insert error:', insertError);
      // Still allow - tracking failed but request is valid
    }

    return {
      allowed: true,
      remaining: remaining - 1,
      resetAt,
    };
  } catch (error) {
    console.error('Rate limit error:', error);
    // Fail open
    return {
      allowed: true,
      remaining: limit,
      resetAt: new Date(now.getTime() + windowSeconds * 1000),
    };
  }
}

/**
 * Get rate limit headers for response
 */
export function getRateLimitHeaders(result: RateLimitResult, limit: number): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.floor(result.resetAt.getTime() / 1000).toString(),
  };

  if (result.retryAfter) {
    headers['Retry-After'] = result.retryAfter.toString();
  }

  return headers;
}

/**
 * Create rate limit exceeded response
 */
export function rateLimitExceededResponse(
  result: RateLimitResult,
  limit: number,
  corsHeaders: Record<string, string> = {}
): Response {
  return new Response(
    JSON.stringify({
      error: 'Too many requests',
      message: `Rate limit exceeded. Try again in ${result.retryAfter} seconds.`,
      retryAfter: result.retryAfter,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        ...getRateLimitHeaders(result, limit),
        ...corsHeaders,
      },
    }
  );
}

/**
 * Get identifier for rate limiting
 * Prioritizes: user_id > IP address > 'anonymous'
 */
export function getRateLimitIdentifier(
  userId: string | null,
  request: Request
): string {
  if (userId) {
    return `user:${userId}`;
  }

  // Try to get IP from headers (Supabase/Vercel sets these)
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0]?.trim() ?? realIp ?? 'anonymous';

  return `ip:${ip}`;
}

/**
 * Clean up old rate limit records (call periodically)
 */
export async function cleanupRateLimits(
  supabase: SupabaseClient,
  olderThanMinutes: number = 5
): Promise<void> {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);

  const { error } = await supabase
    .from('rate_limits')
    .delete()
    .lt('created_at', cutoff.toISOString());

  if (error) {
    console.error('Rate limit cleanup error:', error);
  }
}
