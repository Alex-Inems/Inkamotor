import https from "node:https";

/** IPv4-preferring HTTPS — Next.js fetch often fails on Windows ("fetch failed"). */
export function supabaseHttps(options: {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: Buffer | string;
}): Promise<{ status: number; text: string }> {
  const target = new URL(options.url);
  const method = options.method ?? "GET";
  const headers: Record<string, string> = { ...options.headers };
  if (options.body != null) {
    const len =
      typeof options.body === "string"
        ? Buffer.byteLength(options.body)
        : options.body.length;
    if (!headers["Content-Length"] && !headers["content-length"]) {
      headers["Content-Length"] = String(len);
    }
  }

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: target.hostname,
        port: target.port || 443,
        path: `${target.pathname}${target.search}`,
        method,
        headers,
        ...(process.platform === "win32" ? { family: 4 } : {}),
        timeout: 60_000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            text: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );
    req.on("timeout", () => {
      req.destroy(new Error("Supabase request timed out"));
    });
    req.on("error", (err) => {
      reject(
        new Error(
          err instanceof Error
            ? `Supabase request failed: ${err.message}`
            : "Supabase request failed",
        ),
      );
    });
    if (options.body != null) req.write(options.body);
    req.end();
  });
}

export function supabasePublicObjectUrl(
  supabaseUrl: string,
  bucket: string,
  path: string,
) {
  const base = supabaseUrl.replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${bucket}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}
