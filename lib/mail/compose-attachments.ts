import { readApiJson } from "@/lib/api-client";

export const COMPOSE_MAX_FILES = 5;
/** Soft per-request piece size (Vercel ~4.5 MB body). */
export const COMPOSE_MAX_FILE_BYTES = 3 * 1024 * 1024;
/** Total attachment bytes allowed on one email (after compress / staging). */
export const COMPOSE_MAX_TOTAL_BYTES = 15 * 1024 * 1024;
/** Chunk size when staging large files. */
export const COMPOSE_CHUNK_BYTES = 2.5 * 1024 * 1024;

export type OutboundAttachment = {
  fileName: string;
  mimeType: string;
  /** Set for small files sent with the reply request. */
  base64?: string;
  blob?: Blob;
  /** Set when the file was uploaded via /api/inbox/stage-attachment. */
  stagedId?: string;
};

export type PendingAttachment = {
  id: string;
  file: File;
  fileName: string;
  mimeType: string;
  byteSize: number;
};

export function formatAttachmentBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function extOf(name: string) {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

/** Best-effort MIME when the browser leaves `file.type` empty. */
export function mimeFromFileName(fileName: string): string {
  const ext = extOf(fileName);
  const map: Record<string, string> = {
    // images
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp",
    svg: "image/svg+xml",
    heic: "image/heic",
    heif: "image/heif",
    tif: "image/tiff",
    tiff: "image/tiff",
    ico: "image/x-icon",
    // docs
    pdf: "application/pdf",
    txt: "text/plain",
    csv: "text/csv",
    md: "text/markdown",
    html: "text/html",
    htm: "text/html",
    json: "application/json",
    xml: "application/xml",
    rtf: "application/rtf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    odt: "application/vnd.oasis.opendocument.text",
    ods: "application/vnd.oasis.opendocument.spreadsheet",
    odp: "application/vnd.oasis.opendocument.presentation",
    // archives
    zip: "application/zip",
    rar: "application/vnd.rar",
    "7z": "application/x-7z-compressed",
    gz: "application/gzip",
    tar: "application/x-tar",
    // media
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    m4a: "audio/mp4",
    aac: "audio/aac",
    mp4: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
    avi: "video/x-msvideo",
    mkv: "video/x-matroska",
    // other common
    vcf: "text/vcard",
    ics: "text/calendar",
    apk: "application/vnd.android.package-archive",
  };
  return map[ext] || "application/octet-stream";
}

export function resolveMimeType(mimeType: string | undefined, fileName: string) {
  const raw = mimeType?.trim();
  if (raw && raw !== "application/octet-stream") return raw;
  return mimeFromFileName(fileName);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

/** Raster photos we can shrink; keep GIF/SVG as-is. */
export function isCompressibleImage(mime: string, fileName = "") {
  const m = resolveMimeType(mime, fileName).toLowerCase();
  const ext = extOf(fileName);
  if (m === "image/gif" || ext === "gif") return false;
  if (m === "image/svg+xml" || ext === "svg") return false;
  if (/^image\/(jpeg|jpg|png|webp|heic|heif|bmp|tiff)$/i.test(m)) return true;
  return ["jpg", "jpeg", "png", "webp", "heic", "heif", "bmp", "tif", "tiff"].includes(
    ext,
  );
}

/**
 * Shrink photos until they fit under maxBytes (quality + resolution loop).
 */
export async function compressImageForSend(
  file: File,
  opts?: { maxBytes?: number },
): Promise<{ blob: Blob; fileName: string; mimeType: string }> {
  const maxBytes = opts?.maxBytes ?? COMPOSE_MAX_FILE_BYTES;
  const base = file.name.replace(/\.[^.]+$/, "") || "image";
  const outName = `${base}.jpg`;
  const mime = resolveMimeType(file.type, file.name);

  if (!isCompressibleImage(mime, file.name) || typeof createImageBitmap !== "function") {
    return {
      blob: file,
      fileName: file.name,
      mimeType: mime,
    };
  }

  try {
    const bitmap = await createImageBitmap(file);
    const edges = [1600, 1280, 1024, 800, 640, 480];
    let best: Blob | null = null;

    for (const maxEdge of edges) {
      const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) break;
      ctx.drawImage(bitmap, 0, 0, width, height);

      for (const q of [0.85, 0.72, 0.6, 0.48, 0.36]) {
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/jpeg", q),
        );
        if (!blob) continue;
        best = blob;
        if (blob.size <= maxBytes) {
          bitmap.close();
          return { blob, fileName: outName, mimeType: "image/jpeg" };
        }
      }
    }

    bitmap.close();
    if (best) {
      return { blob: best, fileName: outName, mimeType: "image/jpeg" };
    }
  } catch {
    /* fall through */
  }

  return {
    blob: file,
    fileName: file.name,
    mimeType: mime,
  };
}

export type AttachmentProgress = {
  fileName: string;
  fileIndex: number;
  fileCount: number;
  /** 0–100 overall across all attachments. */
  percent: number;
};

async function stageBlob(input: {
  blob: Blob;
  fileName: string;
  mimeType: string;
  onBytes?: (uploadedBytes: number) => void;
}): Promise<string> {
  const uploadId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `up_${Date.now()}`;

  if (input.blob.size <= COMPOSE_CHUNK_BYTES) {
    const form = new FormData();
    form.set("file", input.blob, input.fileName);
    form.set("fileName", input.fileName);
    form.set("mimeType", input.mimeType);
    const res = await fetch("/api/inbox/stage-attachment", {
      method: "POST",
      body: form,
    });
    const parsed = await readApiJson<{ id?: string }>(res);
    if (!parsed.ok || !parsed.data.id) {
      throw new Error(
        parsed.ok === false
          ? parsed.error
          : `Could not upload ${input.fileName}`,
      );
    }
    input.onBytes?.(input.blob.size);
    return parsed.data.id;
  }

  const total = Math.ceil(input.blob.size / COMPOSE_CHUNK_BYTES);
  let stagedId = "";
  let uploaded = 0;
  for (let i = 0; i < total; i++) {
    const start = i * COMPOSE_CHUNK_BYTES;
    const end = Math.min(input.blob.size, start + COMPOSE_CHUNK_BYTES);
    const chunk = input.blob.slice(start, end);
    const form = new FormData();
    form.set("file", chunk, `${input.fileName}.part${i}`);
    form.set("fileName", input.fileName);
    form.set("mimeType", input.mimeType);
    form.set("uploadId", uploadId);
    form.set("chunkIndex", String(i));
    form.set("chunkTotal", String(total));
    const res = await fetch("/api/inbox/stage-attachment", {
      method: "POST",
      body: form,
    });
    const parsed = await readApiJson<{ id?: string; complete?: boolean }>(res);
    if (!parsed.ok) {
      throw new Error(parsed.error || `Could not upload ${input.fileName}`);
    }
    if (parsed.data.id) stagedId = parsed.data.id;
    uploaded += chunk.size;
    input.onBytes?.(uploaded);
  }
  if (!stagedId) {
    throw new Error(`Could not upload ${input.fileName}`);
  }
  return stagedId;
}

/**
 * Compress raster photos when useful; any other format is sent as-is
 * (staged in chunks when large).
 */
export async function pendingToOutbound(
  files: PendingAttachment[],
  onProgress?: (progress: AttachmentProgress) => void,
): Promise<OutboundAttachment[]> {
  const out: OutboundAttachment[] = [];
  let total = 0;
  const fileCount = files.length;
  const approxTotalBytes = Math.max(
    1,
    files.reduce((sum, file) => sum + file.byteSize, 0),
  );
  let completedBytes = 0;

  const report = (fileName: string, fileIndex: number, withinFile = 0) => {
    // Reserve the last 10% for the actual send — never report complete here.
    const raw =
      ((completedBytes + withinFile) / approxTotalBytes) * 90;
    onProgress?.({
      fileName,
      fileIndex,
      fileCount,
      percent: Math.max(0, Math.min(90, Math.round(raw))),
    });
  };

  for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
    const file = files[fileIndex]!;
    report(file.fileName, fileIndex, 0);

    const mime = resolveMimeType(file.mimeType, file.fileName);
    const prepared = isCompressibleImage(mime, file.fileName)
      ? await compressImageForSend(file.file, {
          maxBytes: COMPOSE_MAX_FILE_BYTES,
        })
      : {
          blob: file.file as Blob,
          fileName: file.fileName,
          mimeType: mime,
        };

    if (prepared.blob.size > COMPOSE_MAX_TOTAL_BYTES) {
      throw new Error(
        `"${file.fileName}" is too large (${formatAttachmentBytes(prepared.blob.size)}). Max ${formatAttachmentBytes(COMPOSE_MAX_TOTAL_BYTES)} per file.`,
      );
    }

    total += prepared.blob.size;
    if (total > COMPOSE_MAX_TOTAL_BYTES) {
      throw new Error(
        `Attachments together exceed ${formatAttachmentBytes(COMPOSE_MAX_TOTAL_BYTES)}.`,
      );
    }

    if (prepared.blob.size <= COMPOSE_MAX_FILE_BYTES) {
      out.push({
        fileName: prepared.fileName,
        mimeType: prepared.mimeType,
        base64: await blobToBase64(prepared.blob),
        blob: prepared.blob,
      });
      completedBytes += file.byteSize;
      report(file.fileName, fileIndex, 0);
      continue;
    }

    const stagedId = await stageBlob({
      blob: prepared.blob,
      fileName: prepared.fileName,
      mimeType: prepared.mimeType,
      onBytes: (uploadedBytes) => {
        const ratio = prepared.blob.size
          ? uploadedBytes / prepared.blob.size
          : 1;
        report(file.fileName, fileIndex, file.byteSize * ratio);
      },
    });
    out.push({
      fileName: prepared.fileName,
      mimeType: prepared.mimeType,
      stagedId,
    });
    completedBytes += file.byteSize;
    report(file.fileName, fileIndex, 0);
  }

  onProgress?.({
    fileName: files[files.length - 1]?.fileName ?? "",
    fileIndex: Math.max(0, fileCount - 1),
    fileCount,
    percent: 90,
  });

  return out;
}

export function validatePendingAttachments(
  files: PendingAttachment[],
  t: (key: string, vars?: Record<string, string | number>) => string,
): string | null {
  if (files.length > COMPOSE_MAX_FILES) {
    return t("pages.inbox.tooManyAttachments", { max: COMPOSE_MAX_FILES });
  }
  for (const file of files) {
    // Allow picking large phone files — we compress images / stage the rest.
    const pickLimit = 40 * 1024 * 1024;
    if (file.byteSize > pickLimit) {
      return t("pages.inbox.attachmentTooLarge", {
        name: file.fileName,
        max: formatAttachmentBytes(pickLimit),
      });
    }
  }
  return null;
}

/** Build multipart body for /api/inbox/reply. */
export function buildReplyFormData(input: {
  toEmail: string;
  toName?: string;
  subject?: string;
  inReplyToSubject?: string;
  message: string;
  relatedMailId?: string;
  relatedInquiryId?: string;
  attachments: OutboundAttachment[];
}) {
  const form = new FormData();
  form.set("toEmail", input.toEmail);
  if (input.toName) form.set("toName", input.toName);
  if (input.subject) form.set("subject", input.subject);
  if (input.inReplyToSubject) form.set("inReplyToSubject", input.inReplyToSubject);
  form.set("message", input.message);
  if (input.relatedMailId) form.set("relatedMailId", input.relatedMailId);
  if (input.relatedInquiryId) form.set("relatedInquiryId", input.relatedInquiryId);

  for (const file of input.attachments) {
    if (file.stagedId) {
      form.append("stagedIds", file.stagedId);
      continue;
    }
    const blob =
      file.blob ??
      (file.base64
        ? new Blob(
            [Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0))],
            { type: file.mimeType },
          )
        : null);
    if (blob) form.append("files", blob, file.fileName);
  }
  return form;
}
