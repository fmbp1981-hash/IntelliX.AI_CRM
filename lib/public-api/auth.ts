import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export type PublicApiAuthResult =
  | { ok: true; organizationId: string; organizationName: string; apiKeyId: string; apiKeyPrefix: string }
  | { ok: false; status: number; body: { error: string; code?: string } };

function getAnonSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  return createSupabaseClient(url, anon);
}

export async function authPublicApi(request: Request): Promise<PublicApiAuthResult> {
  const token = request.headers.get('x-api-key') || '';
  if (!token.trim()) {
    return { ok: false, status: 401, body: { error: 'Missing X-Api-Key', code: 'AUTH_MISSING' } };
  }

  const sb = getAnonSupabase();
  if (!sb) {
    return { ok: false, status: 500, body: { error: 'Supabase not configured', code: 'SERVER_NOT_CONFIGURED' } };
  }

  const { data, error } = await sb.rpc('validate_api_key', { p_token: token }).maybeSingle();
  if (error || !data?.organization_id) {
    return { ok: false, status: 401, body: { error: 'Invalid API key', code: 'AUTH_INVALID' } };
  }

  return {
    ok: true,
    apiKeyId: data.api_key_id,
    apiKeyPrefix: data.api_key_prefix,
    organizationId: data.organization_id,
    organizationName: data.organization_name,
  };
}

