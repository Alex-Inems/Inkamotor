/** Shared helpers for fetch() callers that expect JSON APIs. */

export async function readApiJson<T = unknown>(
  res: Response,
): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  const text = await res.text();
  const trimmed = text.trim();

  if (!trimmed) {
    if (res.ok) return { ok: true, data: {} as T };
    return {
      ok: false,
      status: res.status,
      error: res.statusText || `Request failed (${res.status})`,
    };
  }

  try {
    const data = JSON.parse(trimmed) as T & { error?: string };
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error:
          (typeof data?.error === "string" && data.error) ||
          res.statusText ||
          `Request failed (${res.status})`,
      };
    }
    return { ok: true, data };
  } catch {
    // Platform / proxy plain-text errors (e.g. Vercel 413).
    if (/request entity too large/i.test(trimmed) || res.status === 413) {
      return {
        ok: false,
        status: res.status || 413,
        error:
          "Attachment is too large to send. Try a smaller photo or PDF (under ~3 MB), or compress it first.",
      };
    }
    const preview = trimmed.replace(/\s+/g, " ").slice(0, 120);
    return {
      ok: false,
      status: res.status,
      error: preview || `Request failed (${res.status})`,
    };
  }
}
