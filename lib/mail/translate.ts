import { createHash } from "crypto";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getSupabase } from "@/lib/supabase/server";

const HASH_LEN = 32;
const POOL = 4;
const CHUNK = 900;
const IN_BATCH = 80;

let cacheEnabled = true;

export type TranslateStats = {
  unique: number;
  cached: number;
  translated: number;
  failed: number;
};

function hashText(text: string) {
  return createHash("sha256").update(text, "utf8").digest("hex").slice(0, HASH_LEN);
}

function skipTranslate(text: string) {
  const t = text.trim();
  if (!t) return true;
  if (!/[A-Za-zÀ-ÿĀ-žА-я]/.test(t)) return true;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return true;
  if (/^https?:\/\/\S+$/i.test(t) && t.length < 180) return true;
  return false;
}

function chunkText(text: string, max = CHUNK): string[] {
  if (text.length <= max) return [text];
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > max) {
    let cut = rest.lastIndexOf("\n", max);
    if (cut < max * 0.35) cut = rest.lastIndexOf(". ", max) + 1;
    if (cut < max * 0.35) cut = max;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  if (rest) chunks.push(rest);
  return chunks;
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next;
      next += 1;
      out[i] = await fn(items[i], i);
    }
  }
  const n = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

async function translateGoogle(text: string, target: Locale): Promise<string> {
  const parts = chunkText(text);
  const translated: string[] = [];
  for (const part of parts) {
    const url = new URL("https://translate.googleapis.com/translate_a/single");
    url.searchParams.set("client", "gtx");
    url.searchParams.set("sl", "auto");
    url.searchParams.set("tl", target);
    url.searchParams.set("dt", "t");
    url.searchParams.set("q", part);
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`translate ${res.status}`);
    const data = (await res.json()) as unknown;
    if (!Array.isArray(data) || !Array.isArray(data[0])) {
      throw new Error("translate parse");
    }
    translated.push(
      (data[0] as unknown[])
        .map((row) => (Array.isArray(row) ? String(row[0] ?? "") : ""))
        .join(""),
    );
  }
  return translated.join("");
}

async function translateDeepL(text: string, target: Locale): Promise<string> {
  const key = process.env.DEEPL_API_KEY?.trim();
  if (!key) throw new Error("no deepl");
  const endpoint = key.endsWith(":fx")
    ? "https://api-free.deepl.com/v2/translate"
    : "https://api.deepl.com/v2/translate";
  const body = new URLSearchParams();
  for (const part of chunkText(text, 4000)) body.append("text", part);
  body.set("target_lang", target.toUpperCase());
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) throw new Error(`deepl ${res.status}`);
  const json = (await res.json()) as {
    translations?: { text?: string }[];
  };
  return (json.translations ?? []).map((row) => row.text ?? "").join("");
}

async function translateOne(text: string, target: Locale): Promise<string> {
  if (process.env.DEEPL_API_KEY?.trim()) {
    try {
      const out = await translateDeepL(text, target);
      if (out.trim()) return out;
    } catch {
      /* fall through to Google */
    }
  }
  return translateGoogle(text, target);
}

async function readCache(locale: Locale, hashes: string[]) {
  if (!cacheEnabled || hashes.length === 0) return new Map<string, string>();
  const map = new Map<string, string>();
  try {
    const supabase = getSupabase();
    for (let i = 0; i < hashes.length; i += IN_BATCH) {
      const slice = hashes.slice(i, i + IN_BATCH);
      const { data, error } = await supabase
        .from("mail_translations")
        .select("source_hash, translated")
        .eq("locale", locale)
        .in("source_hash", slice);
      if (error) {
        cacheEnabled = false;
        return map;
      }
      for (const row of data ?? []) {
        map.set(String(row.source_hash), String(row.translated ?? ""));
      }
    }
  } catch {
    cacheEnabled = false;
  }
  return map;
}

async function writeCache(
  locale: Locale,
  rows: { source_hash: string; translated: string }[],
) {
  if (!cacheEnabled || rows.length === 0) return;
  try {
    const supabase = getSupabase();
    for (let i = 0; i < rows.length; i += IN_BATCH) {
      const slice = rows.slice(i, i + IN_BATCH).map((row) => ({
        locale,
        source_hash: row.source_hash,
        translated: row.translated,
      }));
      const { error } = await supabase.from("mail_translations").upsert(slice, {
        onConflict: "locale,source_hash",
      });
      if (error) {
        cacheEnabled = false;
        return;
      }
    }
  } catch {
    cacheEnabled = false;
  }
}

/** Translate many strings into `locale`. Order is preserved. Cached by hash. */
export async function translateTexts(
  texts: string[],
  locale: Locale,
): Promise<{ values: string[]; stats: TranslateStats }> {
  const values = texts.slice();
  const unique = new Map<string, string>();
  for (const text of texts) {
    if (skipTranslate(text)) continue;
    unique.set(hashText(text), text);
  }

  const hashes = [...unique.keys()];
  const cached = await readCache(locale, hashes);
  const missing: { hash: string; text: string }[] = [];
  for (const [hash, text] of unique) {
    if (cached.has(hash)) continue;
    missing.push({ hash, text });
  }

  const stats: TranslateStats = {
    unique: unique.size,
    cached: unique.size - missing.length,
    translated: 0,
    failed: 0,
  };

  const fresh: { source_hash: string; translated: string }[] = [];
  await mapPool(missing, POOL, async (item) => {
    try {
      const translated = await translateOne(item.text, locale);
      const out = translated.trim() ? translated : item.text;
      cached.set(item.hash, out);
      fresh.push({ source_hash: item.hash, translated: out });
      stats.translated += 1;
    } catch {
      cached.set(item.hash, item.text);
      stats.failed += 1;
    }
  });

  await writeCache(locale, fresh);

  for (let i = 0; i < texts.length; i += 1) {
    if (skipTranslate(texts[i])) continue;
    const hit = cached.get(hashText(texts[i]));
    if (hit != null) values[i] = hit;
  }

  return { values, stats };
}

export function parseLocaleParam(value: string | null | undefined): Locale | null {
  return isLocale(value) ? value : null;
}
