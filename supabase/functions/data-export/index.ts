import { createClient } from "https://esm.sh/@supabase/supabase-js@2.96.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify user
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { exportId } = await req.json();

    // Get the export job
    const { data: job, error: jobErr } = await adminClient
      .from("data_exports")
      .select("*")
      .eq("id", exportId)
      .eq("user_id", user.id)
      .single();

    if (jobErr || !job) return new Response(JSON.stringify({ error: "Export not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Rate limit: max 3 exports per hour
    const { count } = await adminClient
      .from("data_exports")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", new Date(Date.now() - 3600000).toISOString());

    if ((count || 0) > 5) {
      await adminClient.from("data_exports").update({ status: "failed", error: "Слишком много экспортов. Попробуйте через час." }).eq("id", exportId);
      return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Mark as running
    await adminClient.from("data_exports").update({ status: "running", started_at: new Date().toISOString() }).eq("id", exportId);

    const userId = user.id;
    const categories: string[] = job.categories || [];
    const format: string = job.format || "json";
    const exportData: Record<string, unknown> = { version: "1.0.0", exported_at: new Date().toISOString(), format, user_id: userId };

    // Fetch data per category
    if (categories.includes("subscriptions")) {
      const { data: subs } = await adminClient.from("subscriptions").select("creator_id, created_at").eq("user_id", userId);
      // Enrich with creator names
      const creatorIds = (subs || []).map((s: any) => s.creator_id);
      let creators: Record<string, string> = {};
      if (creatorIds.length > 0) {
        const { data: profiles } = await adminClient.from("profiles").select("user_id, display_name").in("user_id", creatorIds);
        creators = Object.fromEntries((profiles || []).map((p: any) => [p.user_id, p.display_name]));
      }
      exportData.subscriptions = (subs || []).map((s: any) => ({
        creator_id: s.creator_id,
        creator_name: creators[s.creator_id] || "",
        subscribed_at: s.created_at,
      }));
    }

    if (categories.includes("playlists")) {
      const { data: playlists } = await adminClient.from("playlists").select("id, title, description, is_public, created_at").eq("user_id", userId);
      const playlistIds = (playlists || []).map((p: any) => p.id);
      let items: any[] = [];
      if (playlistIds.length > 0) {
        const { data } = await adminClient.from("playlist_items").select("playlist_id, content_id, sort_order, added_at").in("playlist_id", playlistIds);
        items = data || [];
      }
      exportData.playlists = (playlists || []).map((p: any) => ({
        ...p,
        items: items.filter((i: any) => i.playlist_id === p.id),
      }));
    }

    if (categories.includes("bookmarks")) {
      const { data: bookmarks } = await adminClient.from("bookmarks").select("content_id, created_at").eq("user_id", userId);
      // Enrich with content titles
      const contentIds = (bookmarks || []).map((b: any) => b.content_id);
      let contentMap: Record<string, string> = {};
      if (contentIds.length > 0) {
        const { data: contents } = await adminClient.from("content_items").select("id, title").in("id", contentIds);
        contentMap = Object.fromEntries((contents || []).map((c: any) => [c.id, c.title]));
      }
      exportData.bookmarks = (bookmarks || []).map((b: any) => ({
        content_id: b.content_id,
        content_title: contentMap[b.content_id] || "",
        saved_at: b.created_at,
      }));
    }

    if (categories.includes("templates")) {
      const { data: templates } = await adminClient
        .from("content_items")
        .select("id, title, description, tags, created_at, type, status")
        .eq("creator_id", userId)
        .eq("type", "template");
      exportData.templates = (templates || []).map((t: any) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        tags: t.tags,
        status: t.status,
        created_at: t.created_at,
      }));
    }

    if (categories.includes("projects")) {
      const { data: projects } = await adminClient
        .from("projects")
        .select("id, title, description, goal, audience, status, created_at")
        .eq("user_id", userId);
      exportData.projects = (projects || []).map((p: any) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        goal: p.goal,
        audience: p.audience,
        status: p.status,
        created_at: p.created_at,
      }));
    }

    // Generate file content based on format
    let fileContent: string;
    let fileName: string;
    let contentType: string;

    if (format === "opml" && categories.includes("subscriptions")) {
      // OPML for subscriptions
      const subs = (exportData.subscriptions as any[]) || [];
      const opmlItems = subs.map((s: any) =>
        `    <outline text="${escapeXml(s.creator_name || s.creator_id)}" type="rss" xmlUrl="" htmlUrl="" title="${escapeXml(s.creator_name || s.creator_id)}" creatorId="${s.creator_id}" />`
      ).join("\n");
      fileContent = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>MediaOS Subscriptions Export</title>
    <dateCreated>${new Date().toISOString()}</dateCreated>
    <docs>https://mediaos.app/schema/opml</docs>
  </head>
  <body>
    <outline text="Subscriptions" title="Subscriptions">
${opmlItems}
    </outline>
  </body>
</opml>`;
      fileName = `export-${Date.now()}.opml`;
      contentType = "application/xml";
    } else if (format === "csv") {
      // CSV for playlists/bookmarks
      const lines: string[] = [];
      if (categories.includes("playlists") && exportData.playlists) {
        lines.push("category,playlist_title,content_id,sort_order,added_at");
        for (const pl of exportData.playlists as any[]) {
          for (const item of pl.items || []) {
            lines.push(`playlist,"${escapeCsv(pl.title)}",${item.content_id},${item.sort_order},${item.added_at}`);
          }
        }
      }
      if (categories.includes("bookmarks") && exportData.bookmarks) {
        if (lines.length === 0) lines.push("category,title,content_id,saved_at");
        for (const b of exportData.bookmarks as any[]) {
          lines.push(`bookmark,"${escapeCsv(b.content_title)}",${b.content_id},${b.saved_at}`);
        }
      }
      if (categories.includes("subscriptions") && exportData.subscriptions) {
        if (lines.length === 0) lines.push("category,name,creator_id,subscribed_at");
        for (const s of exportData.subscriptions as any[]) {
          lines.push(`subscription,"${escapeCsv(s.creator_name)}",${s.creator_id},${s.subscribed_at}`);
        }
      }
      fileContent = lines.join("\n");
      fileName = `export-${Date.now()}.csv`;
      contentType = "text/csv";
    } else {
      // JSON (default)
      fileContent = JSON.stringify(exportData, null, 2);
      fileName = `export-${Date.now()}.json`;
      contentType = "application/json";
    }

    // Upload to storage
    const storagePath = `${userId}/${fileName}`;
    const { error: uploadErr } = await adminClient.storage
      .from("data-exports")
      .upload(storagePath, new TextEncoder().encode(fileContent), { contentType, upsert: true });

    if (uploadErr) {
      await adminClient.from("data_exports").update({ status: "failed", error: uploadErr.message }).eq("id", exportId);
      return new Response(JSON.stringify({ error: "Upload failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Update export record
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h
    await adminClient.from("data_exports").update({
      status: "ready",
      file_path: storagePath,
      file_size: new TextEncoder().encode(fileContent).byteLength,
      finished_at: new Date().toISOString(),
      expires_at: expiresAt,
    }).eq("id", exportId);

    return new Response(JSON.stringify({ success: true, status: "ready" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Export error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function escapeCsv(s: string): string {
  return (s || "").replace(/"/g, '""');
}
