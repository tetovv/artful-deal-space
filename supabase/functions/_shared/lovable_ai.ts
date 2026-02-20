// Lovable AI Gateway client — server-only (Edge Functions)
// Uses LOVABLE_API_KEY (auto-provisioned), no external keys needed.

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

function getModel(): string {
  return Deno.env.get("LOVABLE_AI_MODEL") || "google/gemini-3-flash-preview";
}

function getApiKey(): string {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY is not configured");
  return key;
}

export interface LovableMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface CallOptions {
  system: string;
  user: string;
  maxRetries?: number;
  model?: string;
  temperature?: number;
}

/**
 * Call Lovable AI and parse the response as JSON.
 * Retries on parse/validation errors up to maxRetries times.
 */
export async function callLovableJSON<T = unknown>(
  opts: CallOptions,
  validate?: (data: unknown) => T
): Promise<T> {
  const { system, user, maxRetries = 2, model, temperature = 0.3 } = opts;

  const messages: LovableMessage[] = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];

  let lastError = "";

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // On retry, append error feedback
    if (attempt > 0 && lastError) {
      messages.push({
        role: "user",
        content: `Предыдущий ответ невалиден: ${lastError}\n\nВерни корректный JSON без лишнего текста, комментариев и markdown-обёртки.`,
      });
    }

    const response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model || getModel(),
        messages,
        temperature,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const body = await response.text();
      if (status === 429) throw new Error("RATE_LIMIT");
      if (status === 402) throw new Error("PAYMENT_REQUIRED");
      throw new Error(`AI gateway error ${status}: ${body}`);
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || "";

    // Extract JSON from response (strip markdown fences if present)
    let jsonStr = raw.trim();
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) jsonStr = fenceMatch[1].trim();

    // Try to find JSON object or array
    const jsonMatch = jsonStr.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (!jsonMatch) {
      lastError = "Ответ не содержит JSON объект или массив.";
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonMatch[1]);
    } catch (e) {
      lastError = `JSON.parse ошибка: ${(e as Error).message}`;
      continue;
    }

    // Validate with Zod if provided
    if (validate) {
      try {
        return validate(parsed);
      } catch (e) {
        lastError = `Zod validation: ${(e as Error).message}`;
        continue;
      }
    }

    return parsed as T;
  }

  throw new Error(`callLovableJSON failed after ${maxRetries + 1} attempts. Last error: ${lastError}`);
}

/**
 * Call Lovable AI with tool calling for structured output.
 */
export async function callLovableTool<T = unknown>(opts: {
  system: string;
  user: string;
  toolName: string;
  toolDescription: string;
  parameters: Record<string, unknown>;
  model?: string;
}): Promise<T> {
  const { system, user, toolName, toolDescription, parameters, model } = opts;

  const response = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model || getModel(),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: toolName,
            description: toolDescription,
            parameters,
          },
        },
      ],
      tool_choice: { type: "function", function: { name: toolName } },
    }),
  });

  if (!response.ok) {
    const status = response.status;
    const body = await response.text();
    if (status === 429) throw new Error("RATE_LIMIT");
    if (status === 402) throw new Error("PAYMENT_REQUIRED");
    throw new Error(`AI gateway error ${status}: ${body}`);
  }

  const data = await response.json();
  const toolCalls = data.choices?.[0]?.message?.tool_calls;
  if (!toolCalls?.length) throw new Error("No tool call in response");

  return JSON.parse(toolCalls[0].function.arguments) as T;
}
