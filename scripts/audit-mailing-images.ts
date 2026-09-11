/**
 * Verify every image referenced by Odoo-imported mailings is hosted and reachable.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getSupabase } from "../lib/supabase/server";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] == null) process.env[key] = value;
    }
  }
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/^"+|"+$/g, "")
    .trim();
}

function collectUrls(html: string): string[] {
  const found = new Set<string>();
  for (const m of html.matchAll(/\b(?:src|data-original-src)=["']([^"']+)["']/gi)) {
    found.add(decodeHtmlEntities(m[1]!));
  }
  for (const m of html.matchAll(/url\(([^)]+)\)/gi)) {
    found.add(decodeHtmlEntities(m[1]!.replace(/["']/g, "").trim()));
  }
  for (const m of html.matchAll(/&quot;(\/web[^&]+)&quot;/gi)) {
    found.add(decodeHtmlEntities(m[1]!));
  }
  return [...found].filter(
    (u) => u && u !== "null" && !u.startsWith("#") && !u.startsWith("data:"),
  );
}

function isImageLike(url: string) {
  return (
    /\/web\/image|font_to_img|mass_mailing|mailing-assets|\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(
      url,
    ) || url.includes("/storage/v1/object/public/mailing-assets/")
  );
}

async function headOk(url: string): Promise<{ ok: boolean; status: number; type: string }> {
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow" });
    if (res.ok) {
      return {
        ok: true,
        status: res.status,
        type: res.headers.get("content-type") || "",
      };
    }
    // Some CDNs dislike HEAD — try GET range
    const get = await fetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-64" },
      redirect: "follow",
    });
    return {
      ok: get.ok || get.status === 206,
      status: get.status,
      type: get.headers.get("content-type") || "",
    };
  } catch {
    return { ok: false, status: 0, type: "" };
  }
}

async function main() {
  loadEnv();
  const sb = getSupabase();
  const { data, error } = await sb
    .from("newsletter_mailings")
    .select("id,subject,html,odoo_id")
    .not("odoo_id", "is", null);
  if (error) throw new Error(error.message);

  const mailings = data ?? [];
  const urlToMailings = new Map<string, string[]>();
  let mailingsWithImages = 0;
  let relativeLeft = 0;
  let encodedLeft = 0;

  for (const row of mailings) {
    const urls = collectUrls(row.html || "").filter(isImageLike);
    if (urls.length) mailingsWithImages += 1;
    for (const url of urls) {
      if (url.startsWith("/")) relativeLeft += 1;
      if (url.includes("&quot;") || url.startsWith("&")) encodedLeft += 1;
      const list = urlToMailings.get(url) ?? [];
      list.push(row.id);
      urlToMailings.set(url, list);
    }
  }

  const uniqueUrls = [...urlToMailings.keys()];
  const hosted = uniqueUrls.filter((u) =>
    u.includes("/storage/v1/object/public/mailing-assets/"),
  );
  const other = uniqueUrls.filter(
    (u) => !u.includes("/storage/v1/object/public/mailing-assets/"),
  );

  console.log(
    JSON.stringify(
      {
        odooMailings: mailings.length,
        mailingsWithImages,
        uniqueImageUrls: uniqueUrls.length,
        hostedOnSupabase: hosted.length,
        otherUrls: other.length,
        relativePathsRemaining: relativeLeft,
        htmlEncodedPathsRemaining: encodedLeft,
      },
      null,
      2,
    ),
  );

  if (other.length) {
    console.log("\nNon-hosted URLs:");
    for (const u of other.slice(0, 30)) console.log(" -", u);
  }

  // Check reachability of unique hosted URLs (and any others)
  let ok = 0;
  let bad = 0;
  const failures: Array<{ url: string; status: number; usedBy: number }> = [];
  const concurrency = 8;
  for (let i = 0; i < uniqueUrls.length; i += concurrency) {
    const chunk = uniqueUrls.slice(i, i + concurrency);
    const results = await Promise.all(
      chunk.map(async (url) => {
        const result = await headOk(url);
        return { url, ...result };
      }),
    );
    for (const r of results) {
      if (r.ok && (r.type.startsWith("image/") || r.type.includes("octet-stream") || !r.type)) {
        ok += 1;
      } else if (r.ok) {
        // reachable but unexpected type — still count as available if 200
        ok += 1;
      } else {
        bad += 1;
        failures.push({
          url: r.url,
          status: r.status,
          usedBy: urlToMailings.get(r.url)?.length ?? 0,
        });
      }
    }
  }

  // Local manifest coverage vs DB
  const manifestPath = resolve("data/odoo-mailing-images/manifest.json");
  let manifestKeys = 0;
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<
      string,
      unknown
    >;
    manifestKeys = Object.keys(manifest).length;
  }

  // Original export relative image count
  const fullPath = resolve("data/odoo-mailings-full.json");
  let originalUnique = 0;
  if (existsSync(fullPath)) {
    const rows = JSON.parse(readFileSync(fullPath, "utf8")) as Array<{
      html?: string;
    }>;
    const orig = new Set<string>();
    for (const row of rows) {
      for (const u of collectUrls(row.html || "").filter(isImageLike)) {
        // After rewrite, export may already be hosted — count either
        orig.add(u.split("?")[0]!);
      }
    }
    originalUnique = orig.size;
  }

  console.log(
    JSON.stringify(
      {
        reachableOk: ok,
        reachableBad: bad,
        manifestKeys,
        uniqueInExportOrDb: originalUnique,
        failures: failures.slice(0, 20),
      },
      null,
      2,
    ),
  );

  if (bad > 0 || relativeLeft > 0 || other.length > 0) {
    process.exitCode = 1;
  } else {
    console.log("\nALL IMAGES AVAILABLE");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
