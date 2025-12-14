import { corsPreflightResponse, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { requireAuth, AuthError } from "../_shared/auth.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

interface UserWithStatus {
  id: string;
  email: string;
  role: string;
  organization_id: string;
  created_at: string;
  status: "active" | "pending";
  invited_at?: string;
  confirmed_at?: string;
  last_sign_in_at?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return corsPreflightResponse(req);
  }

  try {
    // Any authenticated user can list (will only see their organization)
    const { profile } = await requireAuth(req);

    const usersWithStatus: UserWithStatus[] = [];

    // 1. Get all profiles from this organization (active users)
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .order("created_at", { ascending: false });

    // Add active users from profiles
    for (const p of profiles || []) {
      usersWithStatus.push({
        id: p.id,
        email: p.email,
        role: p.role,
        organization_id: p.organization_id,
        created_at: p.created_at,
        status: "active",
      });
    }

    // 2. Get all auth users and find pending invites for this organization
    const { data: authData } = await supabaseAdmin.auth.admin.listUsers();

    if (authData?.users) {
      const profileIds = new Set((profiles || []).map((p) => p.id));

      for (const authUser of authData.users) {
        // Skip if already in profiles (active user)
        if (profileIds.has(authUser.id)) continue;

        // Check if this is an invited user for our organization
        const metadata = authUser.user_metadata || {};
        if (metadata.organization_id === profile.organization_id) {
          usersWithStatus.push({
            id: authUser.id,
            email: authUser.email || "",
            role: metadata.role || "vendedor",
            organization_id: metadata.organization_id,
            created_at: authUser.created_at,
            status: "pending",
            invited_at: authUser.invited_at || authUser.created_at,
          });
        }
      }
    }

    // Sort by created_at descending
    usersWithStatus.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return jsonResponse({ success: true, users: usersWithStatus }, req);
  } catch (error: unknown) {
    const err = error as Error & { status?: number };
    if (error instanceof AuthError) {
      return errorResponse(err.message, req, err.status);
    }
    return errorResponse(err.message || "Internal error", req, 400);
  }
});
