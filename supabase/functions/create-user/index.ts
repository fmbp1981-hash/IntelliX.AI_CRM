import { corsPreflightResponse, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { requireAdmin, AuthError } from "../_shared/auth.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return corsPreflightResponse(req);
  }

  try {
    // Check admin permission
    const { profile } = await requireAdmin(req);

    const { email, password, role } = await req.json();

    // Create auth user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) throw createError;

    // Create profile linked to same organization
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: newUser.user.id,
        organization_id: profile.organization_id,
        email: email,
        role: role || "vendedor",
      });

    if (profileError) {
      // Rollback: delete auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      throw profileError;
    }

    return jsonResponse(
      { message: "User created successfully", user: newUser },
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
