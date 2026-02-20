export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers: corsHeaders });
  return null;
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function errorResponse(error: string | Error, status = 500): Response {
  const msg = error instanceof Error ? error.message : error;
  if (msg === "RATE_LIMIT")
    return jsonResponse({ error: "Rate limit exceeded, try again later" }, 429);
  if (msg === "PAYMENT_REQUIRED")
    return jsonResponse({ error: "Payment required" }, 402);
  return jsonResponse({ error: msg }, status);
}
