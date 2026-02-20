import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { bik } = await req.json();

    if (!bik || typeof bik !== "string" || !/^\d{9}$/.test(bik)) {
      return errorResponse("BIK must be exactly 9 digits", 400);
    }

    // Use the Central Bank of Russia public XML/JSON endpoint via a known proxy
    // We'll query the dadata suggestions API (free tier, no key needed for BIK)
    // Fallback: use a simple mapping approach via cbr.ru
    const response = await fetch("https://bik-info.ru/api.html?type=json&bik=" + bik, {
      headers: { "Accept": "application/json" },
    });

    if (response.ok) {
      const text = await response.text();
      try {
        const data = JSON.parse(text);
        if (data && data.name) {
          return jsonResponse({ bank_name: data.name, corr_account: data.ks || "" });
        }
      } catch {
        // JSON parse failed, try alternative
      }
    }

    // Fallback: try another free API
    const fallbackResp = await fetch(`https://www.cbr.ru/Queries/AjaxDataSource/131815?bic=${bik}`, {
      headers: { "Accept": "application/json" },
    });

    if (fallbackResp.ok) {
      const fallbackText = await fallbackResp.text();
      try {
        const fallbackData = JSON.parse(fallbackText);
        if (Array.isArray(fallbackData) && fallbackData.length > 0) {
          const entry = fallbackData[0];
          return jsonResponse({
            bank_name: entry.ShortName || entry.FullName || "",
            corr_account: entry.Account || "",
          });
        }
      } catch {
        // parse failed
      }
    }

    // If both fail, return empty result (not an error — just no data found)
    return jsonResponse({ bank_name: "", corr_account: "", not_found: true });
  } catch (err) {
    console.error("BIK lookup error:", err);
    return errorResponse(err instanceof Error ? err.message : "Internal error");
  }
});
