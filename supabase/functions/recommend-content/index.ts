import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { interests, userRole } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Fetch available content from DB
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: contentItems } = await supabase
      .from("content_items")
      .select("id, title, description, type, tags, views, likes, price")
      .limit(50);

    const contentList = (contentItems || [])
      .map((c: any) => `- "${c.title}" (${c.type}, tags: ${(c.tags || []).join(", ")}, views: ${c.views}, likes: ${c.likes}, price: ${c.price || "free"})`)
      .join("\n");

    const systemPrompt = `You are a content recommendation engine for MediaOS platform. 
Given the user's interests and role, rank the available content items and return the top 4-6 most relevant item titles as a JSON array of strings.

User role: ${userRole || "user"}
User interests: ${(interests || []).join(", ") || "general"}

Available content:
${contentList}

Return ONLY a JSON array of exact item titles, ranked by relevance. Example: ["Title 1", "Title 2", "Title 3"]`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Recommend the best content for me based on my interests." },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || "[]";

    // Extract JSON array from response
    let titles: string[] = [];
    try {
      const match = content.match(/\[[\s\S]*\]/);
      if (match) titles = JSON.parse(match[0]);
    } catch {
      titles = [];
    }

    return new Response(JSON.stringify({ recommendations: titles }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("recommend-content error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
