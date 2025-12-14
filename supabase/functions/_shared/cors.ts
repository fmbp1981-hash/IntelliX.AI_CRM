/**
 * Shared CORS utilities for Edge Functions
 * 
 * Follows Supabase's recommended pattern:
 * - CORS headers allow the requesting origin
 * - Real security comes from auth tokens, not CORS
 * - CORS is just browser UX, not a security boundary
 * 
 * @see https://supabase.com/docs/guides/functions/cors
 */

/**
 * Get CORS headers for a request
 * Echoes back the requesting origin (standard pattern)
 */
export function getCorsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get('origin') || '*';

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-setup-token, ai-language-model-id, x-vercel-ai-token, x-openai-api-key, x-anthropic-api-key, x-google-api-key',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET, PUT, DELETE',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * Create a CORS preflight response
 */
export function corsPreflightResponse(req: Request): Response {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(req),
  });
}

/**
 * Create a JSON response with CORS headers
 */
export function jsonResponse(
  data: unknown,
  req: Request,
  status: number = 200
): Response {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        ...getCorsHeaders(req),
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Create an error response with CORS headers
 */
export function errorResponse(
  error: string,
  req: Request,
  status: number = 400
): Response {
  return jsonResponse({ error }, req, status);
}
