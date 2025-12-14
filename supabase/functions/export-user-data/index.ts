/**
 * export-user-data Edge Function
 * T047: LGPD Art. 18º - User data export endpoint
 * 
 * Returns all user data as JSON for LGPD compliance
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
    getCorsHeaders, 
    handleCorsOptions, 
    validateOrigin,
    checkRateLimit,
    rateLimitExceededResponse,
    getRateLimitIdentifier,
    RATE_LIMITS 
} from "../_shared/index.ts"

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleCorsOptions(origin);
  }

  // Validate origin
  const originError = validateOrigin(origin);
  if (originError) return originError;

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Client with user token
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Admin client for audit log
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is authenticated
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Not authenticated" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limiting - very strict for data export
    const identifier = getRateLimitIdentifier(user.id, req);
    const limit = RATE_LIMITS['export-user-data'] || { maxRequests: 3, windowMs: 3600000 }; // 3 per hour
    const rateLimitResult = await checkRateLimit(adminClient, identifier, {
      limit,
      endpoint: 'export-user-data'
    });
    
    if (!rateLimitResult.allowed) {
      return rateLimitExceededResponse(rateLimitResult, limit, corsHeaders);
    }

    // Get user profile
    const { data: profile } = await userClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    // Collect all user data in parallel
    const [
      consentsResult,
      dealsResult,
      contactsResult,
      activitiesResult,
      settingsResult,
      aiConversationsResult,
    ] = await Promise.all([
      userClient.from('user_consents').select('*').eq('user_id', user.id),
      userClient.from('deals').select('*').eq('owner_id', user.id),
      userClient.from('contacts').select('*').eq('owner_id', user.id),
      userClient.from('activities').select('*').eq('owner_id', user.id),
      userClient.from('user_settings').select('*').eq('user_id', user.id),
      userClient.from('ai_conversations').select('id, created_at, provider, model').eq('user_id', user.id),
    ]);

    const userData = {
      export_date: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
        app_metadata: user.app_metadata,
      },
      profile: profile,
      consents: consentsResult.data || [],
      settings: settingsResult.data || [],
      deals: {
        count: (dealsResult.data || []).length,
        records: dealsResult.data || [],
      },
      contacts: {
        count: (contactsResult.data || []).length,
        records: contactsResult.data || [],
      },
      activities: {
        count: (activitiesResult.data || []).length,
        records: activitiesResult.data || [],
      },
      ai_usage: {
        count: (aiConversationsResult.data || []).length,
        records: aiConversationsResult.data || [],
      },
      lgpd_notice: {
        pt_BR: 'Este arquivo contém todos os seus dados pessoais armazenados em nosso sistema, conforme Art. 18º da LGPD.',
        en: 'This file contains all your personal data stored in our system, as per LGPD Art. 18.',
      },
    };

    // Log the data export for audit
    await adminClient.from('audit_logs').insert({
      user_id: user.id,
      organization_id: profile?.organization_id,
      action: 'EXPORT_USER_DATA',
      resource_type: 'user',
      resource_id: user.id,
      severity: 'info',
    }).catch(() => {}); // Don't fail on log error

    // Return as downloadable JSON
    return new Response(
      JSON.stringify(userData, null, 2),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="user-data-${user.id}-${new Date().toISOString().split('T')[0]}.json"`,
        },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Export User Data Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Internal server error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
