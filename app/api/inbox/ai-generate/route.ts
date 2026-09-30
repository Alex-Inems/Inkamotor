import { jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Generate draft text with OpenAI when OPENAI_API_KEY (env) or a settings key
 * is provided. Never invents content when no key is configured.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as {
    prompt?: string;
    apiKey?: string;
    context?: string;
  };
  const prompt = body.prompt?.trim() ?? "";
  if (!prompt) {
    return jsonError(400, { error: "prompt required", code: "bad_request" });
  }

  const apiKey =
    body.apiKey?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    process.env.OPENAI_KEY?.trim() ||
    "";

  if (!apiKey) {
    return jsonError(503, {
      error:
        "Add an OpenAI API key in Settings (openai_api_key) or OPENAI_API_KEY in the environment.",
      code: "missing_credentials",
    });
  }

  const system =
    "You write professional customer emails for Inkamoto Tours, a motorcycle " +
    "tour company in Peru. Write in the same language as the user prompt. " +
    "Return only the email body text, no subject line, no markdown fences.";

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
        temperature: 0.6,
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: body.context?.trim()
              ? `Context:\n${body.context.trim()}\n\nRequest:\n${prompt}`
              : prompt,
          },
        ],
      }),
    });
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };
    if (!res.ok) {
      return jsonError(502, {
        error: json.error?.message || `OpenAI error (${res.status})`,
        code: "send_failed",
      });
    }
    const text = json.choices?.[0]?.message?.content?.trim() || "";
    if (!text) {
      return jsonError(502, {
        error: "AI returned an empty response",
        code: "send_failed",
      });
    }
    return Response.json({ ok: true, text });
  } catch (err) {
    return jsonError(502, {
      error: err instanceof Error ? err.message : "AI request failed",
      code: "send_failed",
    });
  }
}
