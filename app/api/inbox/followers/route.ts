import { jsonError } from "@/lib/api";
import {
  addFollower,
  listFollowers,
  removeFollower,
  removeFollowerByEmail,
} from "@/lib/mail/followers";
import { missingSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (missingSupabaseEnv().length) {
    return Response.json({ ok: true, followers: [] });
  }
  const email = new URL(request.url).searchParams.get("email")?.trim() || "";
  if (!email) {
    return jsonError(400, { error: "email required", code: "bad_request" });
  }
  try {
    const followers = await listFollowers(email);
    return Response.json({ ok: true, followers });
  } catch (err) {
    return jsonError(500, {
      error: err instanceof Error ? err.message : "Could not load followers",
      code: "db_error",
    });
  }
}

export async function POST(request: Request) {
  if (missingSupabaseEnv().length) {
    return jsonError(503, {
      error: "Supabase is not configured",
      code: "missing_credentials",
    });
  }
  const body = (await request.json()) as {
    threadEmail?: string;
    partnerEmail?: string;
    partnerName?: string;
  };
  try {
    const follower = await addFollower({
      threadEmail: body.threadEmail ?? "",
      partnerEmail: body.partnerEmail ?? "",
      partnerName: body.partnerName,
    });
    return Response.json({ ok: true, follower });
  } catch (err) {
    return jsonError(400, {
      error: err instanceof Error ? err.message : "Could not add follower",
      code: "db_error",
    });
  }
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id")?.trim();
  const threadEmail = url.searchParams.get("email")?.trim();
  const partnerEmail = url.searchParams.get("partner")?.trim();
  try {
    if (id) await removeFollower(id);
    else if (threadEmail && partnerEmail) {
      await removeFollowerByEmail(threadEmail, partnerEmail);
    } else {
      return jsonError(400, {
        error: "id or email+partner required",
        code: "bad_request",
      });
    }
    return Response.json({ ok: true });
  } catch (err) {
    return jsonError(400, {
      error: err instanceof Error ? err.message : "Could not remove follower",
      code: "db_error",
    });
  }
}
