/**
 * Shared Supabase Admin Client
 * 
 * Use this for operations that require SERVICE_ROLE privileges:
 * - Creating/deleting auth users
 * - Bypassing RLS
 * - Cross-tenant operations (with proper authorization)
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Singleton admin client with SERVICE_ROLE key
export const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

/**
 * Create a Supabase client with user's auth token
 * For operations that should respect RLS
 */
export function createUserClient(authHeader: string) {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: {
        headers: { Authorization: authHeader },
      },
    }
  );
}
