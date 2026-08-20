import { getFeatureStates } from "@/lib/features";

export const dynamic = "force-dynamic";

/** Shows which live integrations are configured (no secret values). */
export async function GET() {
  const features = getFeatureStates();
  const status = Object.fromEntries(
    features.map((f) => [
      f.id,
      {
        ready: f.ready,
        paused: f.paused,
        missing: f.missing,
      },
    ]),
  );

  // Auth is always ready (hardcoded credentials)
  return Response.json({
    status: {
      auth: { ready: true, paused: false, missing: [] as string[] },
      ...status,
    },
    hint: "Fill Supabase, email sending, and the mailbox. Website forms arrive as email — no webhook needed.",
  });
}
