/** PostgREST / Postgres errors when a migration column is not applied yet. */
export function isMissingColumnError(error: { message?: string } | null | undefined) {
  const msg = error?.message ?? "";
  return /column .* does not exist|could not find the '.*' column|schema cache/i.test(
    msg,
  );
}
