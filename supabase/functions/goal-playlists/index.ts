import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { callLovableJSON } from "../_shared/lovable_ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    // POST /playlists → create
    // GET /playlists/:id → retrieve

    if (req.method === "POST") {
      const body = await req.json();
      const { goalType, timeBudget, mixPrefs, scope } = body;

      if (!goalType || !timeBudget) {
        return new Response(JSON.stringify({ error: "Missing goalType or timeBudget" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 1. Create playlist record
      const { data: playlist, error: insertErr } = await supabaseAdmin
        .from("goal_playlists")
        .insert({
          user_id: user.id,
          goal_type: goalType,
          time_budget: timeBudget,
          mix_prefs: mixPrefs || {},
          scope: scope || "platform",
          status: "processing",
        })
        .select("id")
        .single();

      if (insertErr || !playlist) {
        throw new Error("Failed to create playlist: " + insertErr?.message);
      }

      // 2. Gather content
      let contentQuery = supabaseAdmin
        .from("content_items")
        .select("id, title, type, duration, description, creator_name, monetization_type, price")
        .eq("status", "published")
        .limit(200);

      const { data: platformContent } = await contentQuery;
      let allContent = platformContent || [];

      // Include library (bookmarks) if scope includes it
      if (scope === "library" || scope === "all") {
        const { data: bookmarks } = await supabaseAdmin
          .from("bookmarks")
          .select("content_id")
          .eq("user_id", user.id);
        if (bookmarks?.length) {
          const bookmarkIds = bookmarks.map(b => b.content_id);
          const { data: libContent } = await supabaseAdmin
            .from("content_items")
            .select("id, title, type, duration, description, creator_name, monetization_type, price")
            .in("id", bookmarkIds);
          if (libContent) {
            const existingIds = new Set(allContent.map(c => c.id));
            allContent = [...allContent, ...libContent.filter(c => !existingIds.has(c.id))];
          }
        }
      }

      // Check entitlements for paid content
      const { data: purchases } = await supabaseAdmin
        .from("purchases")
        .select("content_id")
        .eq("user_id", user.id);
      const purchasedIds = new Set((purchases || []).map((p: any) => p.content_id));

      const { data: subs } = await supabaseAdmin
        .from("subscriptions")
        .select("creator_id")
        .eq("user_id", user.id);
      const subscribedCreatorIds = new Set((subs || []).map((s: any) => s.creator_id));

      // Filter to accessible content
      const accessible = allContent.filter((c: any) => {
        if (c.monetization_type === "free" || !c.price || c.price === 0) return true;
        if (purchasedIds.has(c.id)) return true;
        if (c.creator_id && subscribedCreatorIds.has(c.creator_id)) return true;
        return false;
      });

      if (accessible.length === 0) {
        await supabaseAdmin
          .from("goal_playlists")
          .update({ status: "empty" })
          .eq("id", playlist.id);
        return new Response(JSON.stringify({ id: playlist.id, status: "empty" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 3. AI curation
      const contentSummary = accessible.slice(0, 100).map((c: any) => ({
        id: c.id,
        title: c.title,
        type: c.type,
        duration: c.duration || 300,
        creator: c.creator_name,
      }));

      const mixDesc = mixPrefs?.preference
        ? `Content mix preference: ${mixPrefs.preference}`
        : "Balanced content mix";

      const aiResult = await callLovableJSON<{ items: Array<{
        contentId: string;
        estTime: number;
        reason: string;
      }> }>({
        system: `You are a learning playlist curator. Given a goal, time budget, and available content, select and order items into a focused playlist.
Rules:
- Total estimated time must not exceed the time budget (in minutes).
- Each item's estTime is in seconds.
- Provide a short reason (1 sentence) for each item.
- Order items for optimal learning progression.
- ${mixDesc}
- Return JSON: { "items": [{ "contentId": "uuid", "estTime": seconds, "reason": "..." }] }`,
        user: `Goal: "${goalType}"
Time budget: ${timeBudget} minutes
Available content:
${JSON.stringify(contentSummary)}`,
        temperature: 0.4,
      });

      // 4. Insert items
      if (aiResult.items?.length > 0) {
        const itemRows = aiResult.items.map((item, i) => {
          const content = accessible.find((c: any) => c.id === item.contentId);
          return {
            playlist_id: playlist.id,
            content_type: content?.type || "video",
            content_id: item.contentId,
            est_time: item.estTime,
            reason: item.reason,
            sort_order: i,
          };
        });

        await supabaseAdmin.from("goal_playlist_items").insert(itemRows);
      }

      await supabaseAdmin
        .from("goal_playlists")
        .update({ status: "ready" })
        .eq("id", playlist.id);

      return new Response(JSON.stringify({ id: playlist.id, status: "ready" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (req.method === "GET") {
      // GET /goal-playlists/:id
      const playlistId = pathParts[pathParts.length - 1];
      if (!playlistId) {
        return new Response(JSON.stringify({ error: "Missing playlist ID" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: playlist } = await userClient
        .from("goal_playlists")
        .select("*")
        .eq("id", playlistId)
        .single();

      if (!playlist) {
        return new Response(JSON.stringify({ error: "Not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: items } = await userClient
        .from("goal_playlist_items")
        .select("*")
        .eq("playlist_id", playlistId)
        .order("sort_order");

      return new Response(JSON.stringify({ playlist, items: items || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
