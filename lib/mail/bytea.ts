/** Encode bytes for PostgreSQL bytea via PostgREST (`\x` + hex). */
export function encodeByteaHex(bytes: Buffer): string {
  return `\\x${bytes.toString("hex")}`;
}

function looksLikePdf(buf: Buffer) {
  return buf.length >= 4 && buf.subarray(0, 4).toString("ascii") === "%PDF";
}

/** Decode bytea values returned by Supabase / PostgREST. */
export function decodeBytea(raw: unknown): Buffer | null {
  if (raw == null) return null;

  if (Buffer.isBuffer(raw)) {
    return raw.length ? raw : null;
  }

  if (raw instanceof Uint8Array) {
    return raw.length ? Buffer.from(raw) : null;
  }

  if (raw instanceof ArrayBuffer) {
    return raw.byteLength ? Buffer.from(raw) : null;
  }

  if (Array.isArray(raw)) {
    return raw.length ? Buffer.from(raw) : null;
  }

  if (typeof raw === "object") {
    const maybe = raw as { type?: string; data?: unknown };
    if (maybe.type === "Buffer" && Array.isArray(maybe.data)) {
      return maybe.data.length ? Buffer.from(maybe.data as number[]) : null;
    }
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith("\\x") || trimmed.startsWith("\\\\x")) {
      const hex = trimmed.replace(/^\\+x/, "");
      const buf = Buffer.from(hex, "hex");
      return buf.length ? buf : null;
    }

    if (trimmed.startsWith("0x")) {
      const buf = Buffer.from(trimmed.slice(2), "hex");
      return buf.length ? buf : null;
    }

    if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0) {
      const buf = Buffer.from(trimmed, "hex");
      if (looksLikePdf(buf)) return buf;
    }

    const fromBase64 = Buffer.from(trimmed, "base64");
    if (fromBase64.length) return fromBase64;
  }

  return null;
}
