/**
 * Shared Authentication Utilities
 * 
 * Common auth checks used across Edge Functions
 */
import { createUserClient, supabaseAdmin } from "./supabaseAdmin.ts";

export interface AuthenticatedUser {
  user: {
    id: string;
    email?: string;
  };
  profile: {
    id: string;
    role: "admin" | "vendedor";
    organization_id: string;
    email: string;
  };
}

export class AuthError extends Error {
  constructor(
    message: string,
    public status: number = 401
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Require authentication - returns user and profile
 * Throws AuthError if not authenticated
 */
export async function requireAuth(req: Request): Promise<AuthenticatedUser> {
  const authHeader = req.headers.get("Authorization");
  
  if (!authHeader) {
    throw new AuthError("Missing authorization header", 401);
  }

  const userClient = createUserClient(authHeader);

  // Get authenticated user
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  
  if (userError || !user) {
    throw new AuthError("Not authenticated", 401);
  }

  // Get profile with organization info
  const { data: profile, error: profileError } = await userClient
    .from("profiles")
    .select("id, role, organization_id, email")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    throw new AuthError("Profile not found", 404);
  }

  return {
    user: {
      id: user.id,
      email: user.email,
    },
    profile: profile as AuthenticatedUser["profile"],
  };
}

/**
 * Require admin role - returns user and profile
 * Throws AuthError if not admin
 */
export async function requireAdmin(req: Request): Promise<AuthenticatedUser> {
  const auth = await requireAuth(req);

  if (auth.profile.role !== "admin") {
    throw new AuthError("Forbidden: admin access required", 403);
  }

  return auth;
}

/**
 * Validate that target user belongs to same organization
 * Prevents cross-tenant operations
 */
export async function validateSameOrganization(
  targetUserId: string,
  requesterOrganizationId: string
): Promise<{ email: string; organization_id: string }> {
  const { data: targetProfile, error } = await supabaseAdmin
    .from("profiles")
    .select("organization_id, email")
    .eq("id", targetUserId)
    .single();

  if (error || !targetProfile) {
    throw new AuthError("Target user not found", 404);
  }

  if (targetProfile.organization_id !== requesterOrganizationId) {
    throw new AuthError("Forbidden: cross-tenant operation", 403);
  }

  return targetProfile;
}

/**
 * @deprecated Use validateSameOrganization instead
 */
export const validateSameCompany = validateSameOrganization;

/**
 * Get request metadata for audit logging
 */
export function getRequestMetadata(req: Request) {
  return {
    ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    userAgent: req.headers.get("user-agent") || null,
  };
}
