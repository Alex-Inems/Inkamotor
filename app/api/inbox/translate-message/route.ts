import { jsonError } from "@/lib/api";
import { translateTexts } from "@/lib/mail/translate";
import { isLocale, type Locale } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

/** Translate a single message body into the active CRM locale. */
export async function POST(request: Request) {
  const body = (await request.json()) as {
    text?: string;
    locale?: string;
  };
  const text = body.text?.trim() ?? "";
  const locale = (body.locale || "en") as Locale;
  if (!text) {
    return jsonError(400, { error: "text required", code: "bad_request" });
  }
  if (!isLocale(locale)) {
    return jsonError(400, { error: "invalid locale", code: "bad_request" });
  }
  try {
    const { values } = await translateTexts([text], locale);
    return Response.json({ ok: true, translated: values[0] ?? text });
  } catch (err) {
    return jsonError(502, {
      error: err instanceof Error ? err.message : "Translate failed",
      code: "send_failed",
    });
  }
}
