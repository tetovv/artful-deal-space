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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { courseId, fileContent, fileName, description } = await req.json();
    if (!courseId || (!fileContent && !description)) {
      return new Response(JSON.stringify({ error: "courseId and fileContent or description required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    await supabase.from("ai_courses").update({ status: "processing", progress: 20 }).eq("id", courseId);

    const truncated = (fileContent || description || "").slice(0, 30000);

    const systemPrompt = `You are an expert presentation designer. Analyze the provided material and generate a structured presentation with slides.

You MUST respond by calling the "create_presentation" tool. Do not return plain text.

Guidelines:
- Create 8-15 slides based on the material
- First slide is always the title slide
- Last slide is a summary/conclusion
- Each slide should have a title, bullet points or content text, and optional speaker notes
- Slide types: "title", "content", "bullets", "two-column", "quote", "image-placeholder", "summary"
- For "bullets" slides, provide 3-6 bullet points
- For "two-column" slides, provide left and right column content
- All content must be in Russian
- Make titles concise and impactful
- Speaker notes should be detailed talking points`;

    await supabase.from("ai_courses").update({ status: "generating", progress: 40 }).eq("id", courseId);

    const userContent = fileContent
      ? `File: ${fileName || "document"}\n\nContent:\n${truncated}`
      : `Create a presentation about:\n${truncated}`;

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
          { role: "user", content: userContent },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_presentation",
              description: "Create a structured presentation from the analyzed material",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Presentation title in Russian" },
                  slides: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        type: { type: "string", enum: ["title", "content", "bullets", "two-column", "quote", "summary"] },
                        title: { type: "string" },
                        content: { type: "string", description: "Main text content" },
                        bullets: {
                          type: "array",
                          items: { type: "string" },
                          description: "Bullet points for bullets-type slides",
                        },
                        leftColumn: { type: "string", description: "Left column for two-column slides" },
                        rightColumn: { type: "string", description: "Right column for two-column slides" },
                        notes: { type: "string", description: "Speaker notes" },
                      },
                      required: ["id", "type", "title"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["title", "slides"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_presentation" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        await supabase.from("ai_courses").update({ status: "failed", progress: 0 }).eq("id", courseId);
        return new Response(JSON.stringify({ error: "Rate limit exceeded, try again later" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        await supabase.from("ai_courses").update({ status: "failed", progress: 0 }).eq("id", courseId);
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI error:", status, errorText);
      await supabase.from("ai_courses").update({ status: "failed", progress: 0 }).eq("id", courseId);
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await response.json();

    let presentationData: any = null;
    const toolCalls = aiData.choices?.[0]?.message?.tool_calls;
    if (toolCalls?.length) {
      try {
        presentationData = JSON.parse(toolCalls[0].function.arguments);
      } catch (e) {
        console.error("Failed to parse tool call:", e);
      }
    }

    if (!presentationData) {
      const content = aiData.choices?.[0]?.message?.content || "";
      try {
        const match = content.match(/\{[\s\S]*\}/);
        if (match) presentationData = JSON.parse(match[0]);
      } catch { /* ignore */ }
    }

    if (!presentationData || !presentationData.slides?.length) {
      await supabase.from("ai_courses").update({ status: "failed", progress: 0 }).eq("id", courseId);
      return new Response(JSON.stringify({ error: "Failed to generate presentation" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updateError } = await supabase
      .from("ai_courses")
      .update({
        title: presentationData.title || "AI Презентация",
        slides: presentationData.slides,
        status: "completed",
        progress: 100,
      })
      .eq("id", courseId);

    if (updateError) {
      console.error("DB update error:", updateError);
      throw updateError;
    }

    return new Response(JSON.stringify({ success: true, presentation: presentationData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-presentation error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
