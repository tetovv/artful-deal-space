import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const SYSTEM_PROMPT = `Ты — юридический AI-помощник, специализирующийся на российских рекламных договорах и ОРД-маркировке.

Задача: извлечь ключевые поля из текста договора.

Верни JSON-ответ с помощью вызова функции extract_contract_fields. Для каждого поля укажи:
- value: извлечённое значение
- confidence: число от 0 до 1 (уверенность в извлечении)
- sourceSnippet: точная цитата из договора (до 120 символов), из которой извлечено значение

Если поле не найдено, укажи value: "", confidence: 0, sourceSnippet: "".

Правила:
- ИНН: 10 или 12 цифр
- ОГРН: 13 цифр, ОГРНИП: 15 цифр
- Даты: формат YYYY-MM-DD
- Бюджет: только число (без валюты и слов)
- Валюта: ISO код (RUB, USD, EUR)`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, redactSensitive } = await req.json();

    if (!text || typeof text !== "string") {
      return new Response(
        JSON.stringify({ error: "Текст договора не предоставлен" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Optionally redact bank details before sending to AI
    let processedText = text;
    if (redactSensitive) {
      // Mask bank account numbers (20 digits)
      processedText = processedText.replace(/\b\d{20}\b/g, "****BANK_ACCOUNT****");
      // Mask card numbers
      processedText = processedText.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, "****CARD****");
    }

    // Truncate to ~12000 chars to stay within limits
    const truncated = processedText.slice(0, 12000);

    const response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Извлеки данные из следующего договора:\n\n${truncated}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_contract_fields",
              description: "Извлечённые поля из договора",
              parameters: {
                type: "object",
                properties: {
                  partyAdvertiser: {
                    type: "object",
                    properties: {
                      value: { type: "string" },
                      confidence: { type: "number" },
                      sourceSnippet: { type: "string" },
                    },
                    required: ["value", "confidence", "sourceSnippet"],
                  },
                  advertiserInn: {
                    type: "object",
                    properties: {
                      value: { type: "string" },
                      confidence: { type: "number" },
                      sourceSnippet: { type: "string" },
                    },
                    required: ["value", "confidence", "sourceSnippet"],
                  },
                  advertiserOgrn: {
                    type: "object",
                    properties: {
                      value: { type: "string" },
                      confidence: { type: "number" },
                      sourceSnippet: { type: "string" },
                    },
                    required: ["value", "confidence", "sourceSnippet"],
                  },
                  partyExecutor: {
                    type: "object",
                    properties: {
                      value: { type: "string" },
                      confidence: { type: "number" },
                      sourceSnippet: { type: "string" },
                    },
                    required: ["value", "confidence", "sourceSnippet"],
                  },
                  executorInn: {
                    type: "object",
                    properties: {
                      value: { type: "string" },
                      confidence: { type: "number" },
                      sourceSnippet: { type: "string" },
                    },
                    required: ["value", "confidence", "sourceSnippet"],
                  },
                  contractNumber: {
                    type: "object",
                    properties: {
                      value: { type: "string" },
                      confidence: { type: "number" },
                      sourceSnippet: { type: "string" },
                    },
                    required: ["value", "confidence", "sourceSnippet"],
                  },
                  contractDate: {
                    type: "object",
                    properties: {
                      value: { type: "string" },
                      confidence: { type: "number" },
                      sourceSnippet: { type: "string" },
                    },
                    required: ["value", "confidence", "sourceSnippet"],
                  },
                  budget: {
                    type: "object",
                    properties: {
                      value: { type: "string" },
                      confidence: { type: "number" },
                      sourceSnippet: { type: "string" },
                    },
                    required: ["value", "confidence", "sourceSnippet"],
                  },
                  currency: {
                    type: "object",
                    properties: {
                      value: { type: "string" },
                      confidence: { type: "number" },
                      sourceSnippet: { type: "string" },
                    },
                    required: ["value", "confidence", "sourceSnippet"],
                  },
                  startDate: {
                    type: "object",
                    properties: {
                      value: { type: "string" },
                      confidence: { type: "number" },
                      sourceSnippet: { type: "string" },
                    },
                    required: ["value", "confidence", "sourceSnippet"],
                  },
                  endDate: {
                    type: "object",
                    properties: {
                      value: { type: "string" },
                      confidence: { type: "number" },
                      sourceSnippet: { type: "string" },
                    },
                    required: ["value", "confidence", "sourceSnippet"],
                  },
                  contentType: {
                    type: "object",
                    properties: {
                      value: { type: "string" },
                      confidence: { type: "number" },
                      sourceSnippet: { type: "string" },
                    },
                    required: ["value", "confidence", "sourceSnippet"],
                  },
                  placement: {
                    type: "object",
                    properties: {
                      value: { type: "string" },
                      confidence: { type: "number" },
                      sourceSnippet: { type: "string" },
                    },
                    required: ["value", "confidence", "sourceSnippet"],
                  },
                  ordRequirements: {
                    type: "object",
                    properties: {
                      value: { type: "string" },
                      confidence: { type: "number" },
                      sourceSnippet: { type: "string" },
                    },
                    required: ["value", "confidence", "sourceSnippet"],
                  },
                  paymentTerms: {
                    type: "object",
                    properties: {
                      value: { type: "string" },
                      confidence: { type: "number" },
                      sourceSnippet: { type: "string" },
                    },
                    required: ["value", "confidence", "sourceSnippet"],
                  },
                  cancellationClause: {
                    type: "object",
                    properties: {
                      value: { type: "string" },
                      confidence: { type: "number" },
                      sourceSnippet: { type: "string" },
                    },
                    required: ["value", "confidence", "sourceSnippet"],
                  },
                },
                required: [
                  "partyAdvertiser", "advertiserInn", "advertiserOgrn",
                  "partyExecutor", "executorInn",
                  "contractNumber", "contractDate",
                  "budget", "currency",
                  "startDate", "endDate",
                  "contentType", "placement",
                  "ordRequirements", "paymentTerms", "cancellationClause",
                ],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_contract_fields" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const body = await response.text();
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Превышен лимит запросов. Попробуйте позже." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "Необходимо пополнить баланс AI." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.error("AI gateway error:", status, body);
      return new Response(
        JSON.stringify({ error: `Ошибка AI: ${status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const toolCalls = data.choices?.[0]?.message?.tool_calls;
    if (!toolCalls?.length) {
      throw new Error("AI не вернул структурированный ответ");
    }

    const extracted = JSON.parse(toolCalls[0].function.arguments);

    return new Response(JSON.stringify({ fields: extracted }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-contract error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
