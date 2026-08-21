import { NextResponse } from "next/server";
import {
  createSessionToken,
  credentialsMatch,
  sessionCookieOptions,
  workspaceSessionClaims,
} from "@/lib/auth";
import {
  hashPassword,
  isValidEmail,
  MIN_PASSWORD_LENGTH,
  normalizeEmail,
  verifyPassword,
} from "@/lib/auth-password";
import {
  claimsFromCrmUser,
  crmUsersReady,
  createCrmUser,
  findCrmUser,
  touchCrmUserLogin,
} from "@/lib/crm/users";

export const dynamic = "force-dynamic";

type LoginCode =
  | "invalid"
  | "short_password"
  | "google_only"
  | "need_db"
  | "db_error";

function fail(code: LoginCode, error: string, status = 401) {
  return NextResponse.json({ error, code }, { status });
}

export async function POST(request: Request) {
  let body: { email?: string; password?: string };
  try {
    body = (await request.json()) as { email?: string; password?: string };
  } catch {
    return fail("invalid", "Invalid JSON", 400);
  }

  const email = normalizeEmail(body.email ?? "");
  const password = body.password ?? "";
  if (!isValidEmail(email) || !password) {
    return fail("invalid", "Enter an email and password");
  }

  const workspaceOk = credentialsMatch(email, password);

  try {
    if (crmUsersReady()) {
      const user = await findCrmUser(email);

      if (user?.password_hash) {
        const passOk = await verifyPassword(password, user.password_hash);
        if (!passOk && !workspaceOk) {
          return fail("invalid", "Invalid email or password");
        }
        await touchCrmUserLogin(email);
        return signedIn(
          passOk ? claimsFromCrmUser(user) : workspaceSessionClaims(),
        );
      }

      if (user && !user.password_hash) {
        if (workspaceOk) {
          await touchCrmUserLogin(email);
          return signedIn(workspaceSessionClaims());
        }
        return fail(
          "google_only",
          "This email uses Google sign-in. Continue with Google.",
        );
      }

      if (workspaceOk) {
        return signedIn(workspaceSessionClaims());
      }

      if (password.length < MIN_PASSWORD_LENGTH) {
        return fail(
          "short_password",
          `Choose a password with at least ${MIN_PASSWORD_LENGTH} characters`,
          400,
        );
      }

      const name = email.split("@")[0] || email;
      const claims = await createCrmUser({
        email,
        name,
        passwordHash: await hashPassword(password),
      });
      return signedIn(claims);
    }
  } catch {
    if (!workspaceOk) {
      return fail("db_error", "Could not save or check this email", 503);
    }
  }

  if (workspaceOk) {
    return signedIn(workspaceSessionClaims());
  }

  if (!crmUsersReady()) {
    return fail(
      "need_db",
      "Email sign-in needs Supabase. Use Google or the workspace password for now.",
      503,
    );
  }

  return fail("invalid", "Invalid email or password");
}

async function signedIn(claims: {
  email: string;
  name: string;
  picture?: string;
}) {
  const token = await createSessionToken(claims);
  const res = NextResponse.json({ ok: true });
  const cookie = sessionCookieOptions(token);
  res.cookies.set(cookie.name, cookie.value, cookie);
  return res;
}
