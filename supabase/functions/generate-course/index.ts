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
    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { courseId, fileContent, fileName, settings } = await req.json();
    if (!courseId || !fileContent) {
      return new Response(JSON.stringify({ error: "courseId and fileContent required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update status to processing
    await supabase.from("ai_courses").update({ status: "processing", progress: 20 }).eq("id", courseId);

    // Truncate content to ~30k chars to fit context
    const truncated = fileContent.slice(0, 30000);

    // Build settings instructions
    const settingsBlock = settings ? `\n\nUser preferences (MUST follow):\n${settings}` : "";

    const systemPrompt = `You are an expert course designer. Analyze the provided educational material and generate a comprehensive structured course.

You MUST respond by calling the "create_course" tool with the generated course structure. Do not return plain text.
${settingsBlock}

Guidelines:
- Create 3-6 modules based on the material's topics (unless user specifies a different count)
- Each module should have 3-5 lessons
- Include different lesson types: "text" (theory), "quiz" (test questions), "exercise" (practical tasks)
- For quiz lessons, include 3-5 questions in the content field as numbered list
- For exercise lessons, describe the practical task in detail
- For text lessons, provide a summary of the key concepts
- All content must match the language specified in user preferences (default: Russian)
- Adapt your tone, vocabulary, and examples to the specified audience
- Apply the specified style throughout the course
- Make titles clear and descriptive`;

    // Update to generating
    await supabase.from("ai_courses").update({ status: "generating", progress: 40 }).eq("id", courseId);

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
          { role: "user", content: `File: ${fileName || "document"}\n\nContent:\n${truncated}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_course",
              description: "Create a structured course from the analyzed material",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Course title" },
                  modules: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        title: { type: "string" },
                        lessons: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              id: { type: "string" },
                              title: { type: "string" },
                              content: { type: "string" },
                              type: { type: "string", enum: ["text", "quiz", "exercise"] },
                            },
                            required: ["id", "title", "content", "type"],
                            additionalProperties: false,
                          },
                        },
                      },
                      required: ["id", "title", "lessons"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["title", "modules"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_course" } },
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

    // Extract tool call result
    let courseData: any = null;
    const toolCalls = aiData.choices?.[0]?.message?.tool_calls;
    if (toolCalls?.length) {
      try {
        courseData = JSON.parse(toolCalls[0].function.arguments);
      } catch (e) {
        console.error("Failed to parse tool call:", e);
      }
    }

    // Fallback: try parsing from content
    if (!courseData) {
      const content = aiData.choices?.[0]?.message?.content || "";
      try {
        const match = content.match(/\{[\s\S]*\}/);
        if (match) courseData = JSON.parse(match[0]);
      } catch {
        // ignore
      }
    }

    if (!courseData || !courseData.modules?.length) {
      await supabase.from("ai_courses").update({ status: "failed", progress: 0 }).eq("id", courseId);
      return new Response(JSON.stringify({ error: "Failed to generate course structure" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save the generated course
    const { error: updateError } = await supabase
      .from("ai_courses")
      .update({
        title: courseData.title || "AI Курс",
        modules: courseData.modules,
        status: "completed",
        progress: 100,
      })
      .eq("id", courseId);

    if (updateError) {
      console.error("DB update error:", updateError);
      throw updateError;
    }

    return new Response(JSON.stringify({ success: true, course: courseData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-course error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
