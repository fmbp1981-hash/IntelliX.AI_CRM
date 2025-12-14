import { corsPreflightResponse, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { requireAdmin, validateSameOrganization, getRequestMetadata, AuthError } from "../_shared/auth.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return corsPreflightResponse(req);
  }

  const { ipAddress, userAgent } = getRequestMetadata(req);

  try {
    // Check admin permission
    const { user, profile } = await requireAdmin(req);

    // Parse request body
    const { userId } = await req.json();

    if (!userId) {
      throw new AuthError("userId is required", 400);
    }

    // Can't delete yourself
    if (userId === user.id) {
      throw new AuthError("Você não pode remover a si mesmo", 400);
    }

    // Validate same organization (VULN-004 fix)
    let targetProfile;
    try {
      targetProfile = await validateSameOrganization(userId, profile.organization_id);
    } catch {
      // Log cross-tenant attempt (fire-and-forget)
      supabaseAdmin.rpc("log_audit_event", {
        p_user_id: user.id,
        p_action: "CROSS_TENANT_DELETE_ATTEMPT",
        p_target_type: "user",
        p_target_id: userId,
        p_organization_id: profile.organization_id,
        p_details: { attacker_organization: profile.organization_id },
        p_ip_address: ipAddress,
        p_user_agent: userAgent,
        p_success: false,
      }).then(() => {}).catch(() => {});

      return errorResponse("Forbidden: cross-tenant operation", req, 403);
    }

    // Delete profile first
    await supabaseAdmin.from("profiles").delete().eq("id", userId);

    // Delete auth user
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteError) {
      throw new Error(`Failed to delete user: ${deleteError.message}`);
    }

    // Log successful deletion (fire-and-forget)
    supabaseAdmin.rpc("log_audit_event", {
      p_user_id: user.id,
      p_action: "USER_DELETE",
      p_target_type: "user",
      p_target_id: userId,
      p_organization_id: profile.organization_id,
      p_details: { target_email: targetProfile.email },
      p_ip_address: ipAddress,
      p_user_agent: userAgent,
      p_success: true,
    }).then(() => {}).catch(() => {});

    return jsonResponse({ success: true, message: "User deleted successfully" }, req);
  } catch (error: unknown) {
    const err = error as Error & { status?: number };
    if (error instanceof AuthError) {
      return errorResponse(err.message, req, err.status);
    }
    return jsonResponse({ success: false, error: err.message || "Internal error" }, req);
  }
});
