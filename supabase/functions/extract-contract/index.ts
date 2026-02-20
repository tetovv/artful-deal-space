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

const fieldSchema = {
  type: "object" as const,
  properties: {
    value: { type: "string" },
    confidence: { type: "number" },
    sourceSnippet: { type: "string" },
  },
  required: ["value", "confidence", "sourceSnippet"],
};

const fieldNames = [
  "partyAdvertiser", "advertiserInn", "advertiserOgrn",
  "partyExecutor", "executorInn",
  "contractNumber", "contractDate",
  "budget", "currency",
  "startDate", "endDate",
  "contentType", "placement",
  "ordRequirements", "paymentTerms", "cancellationClause",
];

// ─── PDF text extraction using unpdf (designed for serverless/Deno) ───
async function extractPdfText(data: Uint8Array): Promise<string> {
  try {
    const { extractText, getDocumentProxy } = await import("https://esm.sh/unpdf@0.12.1");
    const pdf = await getDocumentProxy(data);
    const { text } = await extractText(pdf, { mergePages: true });
    return text || "";
  } catch (e) {
    console.error("PDF parse error:", e);
    throw new Error("PDF_PARSE_FAILED");
  }
}

// ─── DOCX text extraction (manual ZIP + XML parsing, no mammoth dependency) ───
async function extractDocxText(data: Uint8Array): Promise<string> {
  try {
    const JSZip = (await import("https://esm.sh/jszip@3.10.1")).default;
    const zip = await JSZip.loadAsync(data);
    const docXml = await zip.file("word/document.xml")?.async("string");
    if (!docXml) throw new Error("No word/document.xml found in DOCX");
    
    // Strip XML tags, extract text content
    // Replace paragraph/break tags with newlines first
    const withBreaks = docXml
      .replace(/<\/w:p>/g, "\n")
      .replace(/<w:br[^>]*\/>/g, "\n")
      .replace(/<w:tab[^>]*\/>/g, "\t");
    // Remove all XML tags
    const text = withBreaks.replace(/<[^>]+>/g, "");
    // Clean up whitespace
    return text.replace(/\n{3,}/g, "\n\n").trim();
  } catch (e) {
    console.error("DOCX parse error:", e);
    throw new Error("DOCX_PARSE_FAILED");
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const contentType = req.headers.get("content-type") || "";
    let text: string;
    let redactSensitive = false;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      redactSensitive = formData.get("redactSensitive") === "true";

      if (!file) {
        return new Response(
          JSON.stringify({ error: "Файл не предоставлен" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const fileBytes = new Uint8Array(await file.arrayBuffer());
      const fileName = file.name.toLowerCase();

      if (fileName.endsWith(".pdf")) {
        text = await extractPdfText(fileBytes);
      } else if (fileName.endsWith(".docx")) {
        text = await extractDocxText(fileBytes);
      } else {
        text = new TextDecoder().decode(fileBytes);
      }
    } else {
      const body = await req.json();
      text = body.text;
      redactSensitive = body.redactSensitive || false;
    }

    if (!text || text.trim().length < 50) {
      return new Response(
        JSON.stringify({ error: "Не удалось извлечь текст из документа. Убедитесь, что файл содержит читаемый текст, а не сканированные изображения." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let processedText = text;
    if (redactSensitive) {
      processedText = processedText.replace(/\b\d{20}\b/g, "****BANK_ACCOUNT****");
      processedText = processedText.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, "****CARD****");
    }

    const truncated = processedText.slice(0, 12000);

    const properties: Record<string, typeof fieldSchema> = {};
    for (const name of fieldNames) {
      properties[name] = fieldSchema;
    }

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
                properties,
                required: fieldNames,
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
        JSON.stringify({ error: "Сервис AI временно недоступен. Повторите попытку позже." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const toolCalls = data.choices?.[0]?.message?.tool_calls;
    if (!toolCalls?.length) {
      throw new Error("AI не вернул структурированный ответ");
    }

    const extracted = JSON.parse(toolCalls[0].function.arguments);

    return new Response(JSON.stringify({ fields: extracted, textLength: text.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-contract error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";

    let userMessage = "Произошла ошибка при обработке документа. Попробуйте ещё раз.";
    if (msg === "PDF_PARSE_FAILED") {
      userMessage = "Не удалось прочитать PDF-файл. Убедитесь, что файл не повреждён и содержит текст (не сканированное изображение).";
    } else if (msg === "DOCX_PARSE_FAILED") {
      userMessage = "Не удалось прочитать DOCX-файл. Убедитесь, что файл не повреждён.";
    }

    return new Response(JSON.stringify({ error: userMessage, _debug: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
