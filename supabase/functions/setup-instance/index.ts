import { corsPreflightResponse, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getRequestMetadata } from "../_shared/auth.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return corsPreflightResponse(req);
  }

  const { ipAddress, userAgent } = getRequestMetadata(req);

  try {
    const { companyName, email, password } = await req.json();

    // Only allow setup if not initialized
    const { data: isInitialized, error: initError } = await supabaseAdmin.rpc(
      "is_instance_initialized"
    );

    if (initError) throw initError;
    if (isInitialized) {
      // Log attempt (fire-and-forget, errors ignored)
      supabaseAdmin.rpc("log_audit_event", {
        p_user_id: null,
        p_action: "SETUP_INSTANCE_BLOCKED",
        p_details: { reason: "instance_already_initialized" },
        p_ip_address: ipAddress,
        p_user_agent: userAgent,
        p_success: false,
      }).then(() => {}).catch(() => {});

      return errorResponse("Instance already initialized", req, 403);
    }

    // Create organization (renamed from company)
    const { data: organization, error: orgError } = await supabaseAdmin
      .from("organizations")
      .insert({ name: companyName })
      .select()
      .single();

    if (orgError) throw orgError;

    // Create user
    const { data: user, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: "admin",
        organization_id: organization.id,
      },
    });

    if (userError) {
      await supabaseAdmin.from("organizations").delete().eq("id", organization.id);
      throw userError;
    }

    // Create profile
    const { error: insertProfileError } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: user.user.id,
          email: email,
          name: email.split("@")[0],
          organization_id: organization.id,
          role: "admin",
        },
        { onConflict: "id" }
      );

    if (insertProfileError) {
      await supabaseAdmin.auth.admin.deleteUser(user.user.id);
      await supabaseAdmin.from("organizations").delete().eq("id", organization.id);
      throw insertProfileError;
    }

    // Log success (fire-and-forget, errors ignored)
    supabaseAdmin.rpc("log_audit_event", {
      p_user_id: user.user.id,
      p_action: "SETUP_INSTANCE",
      p_target_type: "organization",
      p_target_id: organization.id,
      p_organization_id: organization.id,
      p_details: { email, organization_name: companyName },
      p_ip_address: ipAddress,
      p_user_agent: userAgent,
      p_success: true,
    }).then(() => {}).catch(() => {});

    return jsonResponse({ message: "Instance setup successfully", organization, user }, req);
  } catch (error: unknown) {
    const err = error as Error;
    return errorResponse(err.message || "Internal error", req, 400);
  }
});
