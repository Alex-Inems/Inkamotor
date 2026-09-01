export const COMPOSE_MAX_FILES = 5;
export const COMPOSE_MAX_FILE_BYTES = 10 * 1024 * 1024;

export type OutboundAttachment = {
  fileName: string;
  mimeType: string;
  base64: string;
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

export async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function pendingToOutbound(
  files: PendingAttachment[],
): Promise<OutboundAttachment[]> {
  const out: OutboundAttachment[] = [];
  for (const file of files) {
    out.push({
      fileName: file.fileName,
      mimeType: file.mimeType,
      base64: await fileToBase64(file.file),
    });
  }
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
    if (file.byteSize > COMPOSE_MAX_FILE_BYTES) {
      return t("pages.inbox.attachmentTooLarge", {
        name: file.fileName,
        max: formatAttachmentBytes(COMPOSE_MAX_FILE_BYTES),
      });
    }
  }
  return null;
}
