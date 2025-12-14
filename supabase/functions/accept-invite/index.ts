import { corsPreflightResponse, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getRequestMetadata } from "../_shared/auth.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return corsPreflightResponse(req);
  }

  const { ipAddress, userAgent } = getRequestMetadata(req);

  try {
    const { email, password, token, name } = await req.json();

    if (!email || !password || !token) {
      throw new Error("Email, password and token are required");
    }

    // Validate token (not used and not expired)
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("organization_invites")
      .select("*")
      .eq("token", token)
      .is("used_at", null)
      .single();

    if (inviteError || !invite) {
      // Log attempt (fire-and-forget)
      supabaseAdmin.rpc("log_audit_event", {
        p_user_id: null,
        p_action: "INVITE_REUSE_ATTEMPT",
        p_target_type: "invite",
        p_details: { token_prefix: token.substring(0, 8), email },
        p_ip_address: ipAddress,
        p_user_agent: userAgent,
        p_success: false,
      }).then(() => { }).catch(() => { });

      return errorResponse("Convite inválido ou já foi utilizado", req, 400);
    }

    // Check expiration
    if (new Date(invite.expires_at) < new Date()) {
      // Log expired attempt (fire-and-forget)
      supabaseAdmin.rpc("log_audit_event", {
        p_user_id: null,
        p_action: "INVITE_EXPIRED_ATTEMPT",
        p_target_type: "invite",
        p_target_id: invite.id,
        p_organization_id: invite.organization_id,
        p_details: { email, expired_at: invite.expires_at },
        p_ip_address: ipAddress,
        p_user_agent: userAgent,
        p_success: false,
      }).then(() => { }).catch(() => { });

      return errorResponse("Convite expirado", req, 400);
    }

    // Check if email matches
    if (invite.email && invite.email.toLowerCase() !== email.toLowerCase()) {
      throw new Error("Este convite não é válido para este email");
    }

    // Create user
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name: name || email.split("@")[0],
        organization_id: invite.organization_id,
        role: invite.role,
      },
    });

    if (createError) throw createError;

    // Create/update profile (upsert because trigger might have already created it)
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: authData.user.id,
        email: email,
        name: name || email.split("@")[0],
        role: invite.role,
        organization_id: invite.organization_id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw profileError;
    }

    // Mark token as used
    await supabaseAdmin
      .from("organization_invites")
      .update({ used_at: new Date().toISOString() })
      .eq("id", invite.id);

    // Log success (fire-and-forget)
    supabaseAdmin.rpc("log_audit_event", {
      p_user_id: authData.user.id,
      p_action: "INVITE_USED",
      p_target_type: "invite",
      p_target_id: invite.id,
      p_organization_id: invite.organization_id,
      p_details: { email, role: invite.role },
      p_ip_address: ipAddress,
      p_user_agent: userAgent,
      p_success: true,
    }).then(() => { }).catch(() => { });

    return jsonResponse(
      { user: authData.user, message: "Convite aceito com sucesso!" },
      req
    );
  } catch (error: unknown) {
    const err = error as Error;
    return errorResponse(err.message || "Internal error", req, 400);
  }
});
