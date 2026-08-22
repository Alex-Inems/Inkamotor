import https from "node:https";

/** IPv4-only HTTPS so Google calls work on Windows (same as Brevo). */
export function googleHttps(options: {
  hostname: string;
  path: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}): Promise<{
  status: number;
  text: string;
  setCookie: string[];
  location?: string;
}> {
  const method = options.method ?? "GET";
  const headers = { ...options.headers };
  if (options.body && !headers["Content-Length"] && !headers["content-length"]) {
    headers["Content-Length"] = String(Buffer.byteLength(options.body));
  }

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: options.hostname,
        path: options.path,
        method,
        headers,
        ...(process.platform === "win32" ? { family: 4 } : {}),
        timeout: 20000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        const raw = res.headers["set-cookie"];
        const setCookie = !raw ? [] : Array.isArray(raw) ? raw : [raw];
        res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            text: Buffer.concat(chunks).toString("utf8"),
            setCookie,
            location:
              typeof res.headers.location === "string"
                ? res.headers.location
                : undefined,
          });
        });
      },
    );
    req.on("timeout", () => {
      req.destroy(new Error("Google request timed out"));
    });
    req.on("error", (err) => {
      reject(
        new Error(
          err instanceof Error
            ? `Google request failed: ${err.message}`
            : "Google request failed",
        ),
      );
    });
    if (options.body) req.write(options.body);
    req.end();
  });
}
