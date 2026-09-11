/**
 * Local sink for Odoo mailing images fetched in-browser.
 * POST /image  { path, contentType, base64 }
 * GET  /health
 *
 * Usage: npx tsx scripts/odoo-image-sink.ts
 */
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve, extname } from "node:path";

const PORT = 8765;
const OUT_DIR = resolve(process.cwd(), "data", "odoo-mailing-images");
const MANIFEST = resolve(OUT_DIR, "manifest.json");

mkdirSync(OUT_DIR, { recursive: true });

type Manifest = Record<
  string,
  { file: string; contentType: string; bytes: number }
>;

function loadManifest(): Manifest {
  if (!existsSync(MANIFEST)) return {};
  return JSON.parse(readFileSync(MANIFEST, "utf8")) as Manifest;
}

function saveManifest(m: Manifest) {
  writeFileSync(MANIFEST, JSON.stringify(m, null, 2));
}

function extFor(contentType: string, path: string) {
  if (contentType.includes("png")) return ".png";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return ".jpg";
  if (contentType.includes("gif")) return ".gif";
  if (contentType.includes("webp")) return ".webp";
  if (contentType.includes("svg")) return ".svg";
  const e = extname(path.split("?")[0] || "");
  return e || ".bin";
}

const server = createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    const m = loadManifest();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, images: Object.keys(m).length }));
    return;
  }

  if (req.method === "POST" && req.url === "/image") {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
          path: string;
          contentType?: string;
          base64: string;
        };
        const path = String(body.path || "").trim();
        if (!path || !body.base64) {
          res.writeHead(400);
          res.end("bad");
          return;
        }
        const contentType = body.contentType || "application/octet-stream";
        const buf = Buffer.from(body.base64, "base64");
        const hash = createHash("sha1").update(path).digest("hex").slice(0, 16);
        const file = `${hash}${extFor(contentType, path)}`;
        writeFileSync(resolve(OUT_DIR, file), buf);
        const manifest = loadManifest();
        manifest[path] = { file, contentType, bytes: buf.length };
        // Also index without query string for lookups
        const bare = path.split("?")[0]!;
        if (bare !== path) manifest[bare] = manifest[path]!;
        saveManifest(manifest);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, file, bytes: buf.length }));
        console.log("saved", file, buf.length, path.slice(0, 80));
      } catch (err) {
        res.writeHead(500);
        res.end(String(err));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end("no");
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`odoo image sink on http://127.0.0.1:${PORT}`);
});
