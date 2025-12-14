import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getServiceRoleKey, getSupabaseUrl, requireEnv } from './env';

let adminClient: SupabaseClient | null = null;

type SupabaseResult<T> = {
  data: T | null;
  error: unknown | null;
};

export function getSupabaseAdminClient(): SupabaseClient {
  if (adminClient) return adminClient;

  const url = getSupabaseUrl() || requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const key = getServiceRoleKey() || requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  adminClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return adminClient;
}

export function assertNoSupabaseError(
  res: { error: unknown | null },
  context: string,
): void {
  if (!res.error) return;

  const details =
    typeof res.error === 'object'
      ? JSON.stringify(res.error, null, 2)
      : String(res.error);
  throw new Error(`Supabase error (${context}): ${details}`);
}

export function requireSupabaseData<T>(res: SupabaseResult<T>, context: string): T {
  assertNoSupabaseError(res, context);
  if (res.data == null) {
    throw new Error(`Supabase returned no data (${context})`);
  }
  return res.data;
}
