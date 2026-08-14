export function missingEnv(keys: readonly string[]): string[] {
  return keys.filter((key) => !process.env[key]?.trim());
}

export type ApiErrorBody = {
  error: string;
  code: "missing_credentials" | "sync_failed" | "send_failed" | "db_error";
  missing?: string[];
};

export function jsonError(
  status: number,
  body: ApiErrorBody,
): Response {
  return Response.json(body, { status });
}
