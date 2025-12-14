import { corsPreflightResponse, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { requireAdmin, AuthError } from "../_shared/auth.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

interface InviteRequest {
  emails: string[];
  role: "admin" | "vendedor";
}

interface InviteResult {
  email: string;
  success: boolean;
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return corsPreflightResponse(req);
  }

  try {
    // Check admin permission
    const { user, profile } = await requireAdmin(req);

    // Parse request body
    const { emails, role }: InviteRequest = await req.json();

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      throw new AuthError("At least one email is required", 400);
    }

    if (!role || !["admin", "vendedor"].includes(role)) {
      throw new AuthError("Invalid role. Must be 'admin' or 'vendedor'", 400);
    }

    // Get site URL for redirect
    const siteUrl = Deno.env.get("SITE_URL") || "http://localhost:3000";

    // Send invites
    const results: InviteResult[] = [];

    for (const email of emails) {
      try {
        // Check if user already exists in this organization
        const { data: existingProfile } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("email", email)
          .eq("organization_id", profile.organization_id)
          .single();

        if (existingProfile) {
          results.push({
            email,
            success: false,
            error: "Usuário já existe nesta organização",
          });
          continue;
        }

        // Send invite email using Supabase Admin API
        const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
          redirectTo: `${siteUrl}/auth/callback?role=${role}&organization_id=${profile.organization_id}`,
          data: {
            role,
            organization_id: profile.organization_id,
            invited_by: user.id,
          },
        });

        if (error) {
          results.push({ email, success: false, error: error.message });
        } else {
          results.push({ email, success: true });
        }
      } catch (err: unknown) {
        const e = err as Error;
        results.push({ email, success: false, error: e.message || "Unknown error" });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return jsonResponse(
      {
        success: true,
        message: `${successCount} convite(s) enviado(s)${failCount > 0 ? `, ${failCount} falha(s)` : ""}`,
        results,
      },
      req
    );
  } catch (error: unknown) {
    const err = error as Error & { status?: number };
    if (error instanceof AuthError) {
      return errorResponse(err.message, req, err.status);
    }
    return errorResponse(err.message || "Internal error", req, 400);
  }
});
