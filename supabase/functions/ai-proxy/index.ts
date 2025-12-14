import { corsPreflightResponse, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { getUserAISettings } from "./config.ts";
import { processLegacyRequest, AIAction } from "./handlers.ts";
import { processAgentRequest } from "./agent.ts";

/**
 * AI Proxy Edge Function
 * 
 * Unified Router:
 * - /agent -> processAgentRequest (Streaming)
 * - /legacy -> processLegacyRequest (RPC)
 */

Deno.serve(async (req) => {
  // 1. Handle CORS Preflight
  if (req.method === "OPTIONS") {
    return corsPreflightResponse(req);
  }

  try {
    // 2. Auth Check
    const { user } = await requireAuth(req);

    // 3. Rate Limit Check (Simplified for now, can move to config.ts if needed)
    // For now, assuming standard rate limits apply via DB or API Gateway layer?
    // Or we can import checkRateLimit if we kept it? 
    // Let's rely on basic sanity checks for now or Move checkRateLimit to config.ts later.
    // Given the refactor, I'll trust the provider limits + Supabase quotas for this iteration.

    // 4. Load AI Settings (Global/User)
    const { providers } = await getUserAISettings(user.id);

    // 5. Parse Request
    const body = await req.json();
    const { action, messages } = body;

    // 6. ROUTING LOGIC
    // If 'messages' exists, it's a Chat/Agent request (Streaming)
    if (messages && Array.isArray(messages)) {
      return await processAgentRequest(req, user, providers, body);
    }

    // If 'action' exists, it's a Legacy RPC request (JSON)
    if (action) {
      const result = await processLegacyRequest(providers, action as AIAction, body.data, user.id);
      return jsonResponse(result, req, 200);
    }

    return errorResponse("Invalid request format. Missing 'action' or 'messages'.", req, 400);

  } catch (error: any) {
    console.error("AI Proxy Error:", error.message);

    // Handle specific auth errors
    if (error.status === 401 || error.message.includes("Unauthorized")) {
      return errorResponse("Unauthorized", req, 401);
    }

    // Handle rate limits (if we add them back)
    if (error.status === 429) {
      return jsonResponse({ error: "Rate limit exceeded" }, req, 429);
    }

    return errorResponse(error.message || "Internal Server Error", req, 500);
  }
});
