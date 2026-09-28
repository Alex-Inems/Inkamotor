import { missingEnv } from "@/lib/api";

const SESSION_KEYS = ["ODOO_URL", "ODOO_DB"] as const;

export type OdooSessionConfig = {
  url: string;
  db: string;
  login: string;
  password: string;
};

export function missingOdooSessionEnv(): string[] {
  const missing = missingEnv([...SESSION_KEYS]);
  const login =
    process.env.ODOO_LOGIN?.trim() || process.env.CRM_ACCESS_EMAIL?.trim();
  const password =
    process.env.ODOO_PASSWORD?.trim() ||
    process.env.ODOO_API_KEY?.trim() ||
    "";
  if (!login) missing.push("ODOO_LOGIN");
  if (!password) missing.push("ODOO_PASSWORD");
  return missing;
}

export function readOdooSessionConfig(): OdooSessionConfig {
  const missing = missingOdooSessionEnv();
  if (missing.length) {
    throw new Error(`Missing Odoo session env: ${missing.join(", ")}`);
  }
  return {
    url: (process.env.ODOO_URL || "https://inkamoto-tours.odoo.com")
      .trim()
      .replace(/\/$/, ""),
    db: process.env.ODOO_DB!.trim(),
    login: (
      process.env.ODOO_LOGIN?.trim() ||
      process.env.CRM_ACCESS_EMAIL?.trim() ||
      ""
    ),
    password: (
      process.env.ODOO_PASSWORD?.trim() ||
      process.env.ODOO_API_KEY?.trim() ||
      ""
    ),
  };
}

export type OdooSessionClient = {
  config: OdooSessionConfig;
  uid: number;
  executeKw: <T>(
    model: string,
    method: string,
    args?: unknown[],
    kwargs?: Record<string, unknown>,
  ) => Promise<T>;
};

/**
 * Authenticate via Odoo web session (works on Odoo Online without External API plan).
 * Prefer a dedicated ODOO_LOGIN / ODOO_PASSWORD — CRM password often differs.
 */
export async function connectOdooSession(
  config = readOdooSessionConfig(),
): Promise<OdooSessionClient> {
  const authRes = await fetch(`${config.url}/web/session/authenticate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      id: 1,
      params: {
        db: config.db,
        login: config.login,
        password: config.password,
      },
    }),
  });
  const authJson = (await authRes.json()) as {
    result?: { uid?: number };
    error?: { message?: string; data?: { message?: string } };
  };
  const uid = authJson.result?.uid;
  if (!uid) {
    throw new Error(
      authJson.error?.data?.message ||
        authJson.error?.message ||
        "Odoo session auth failed (check ODOO_LOGIN / ODOO_PASSWORD)",
    );
  }

  const setCookies =
    typeof authRes.headers.getSetCookie === "function"
      ? authRes.headers.getSetCookie()
      : [];
  const cookie =
    setCookies.map((c) => c.split(";")[0]).join("; ") ||
    authRes.headers.get("set-cookie")?.split(",")[0]?.split(";")[0] ||
    "";

  if (!cookie) {
    throw new Error("Odoo session authenticated but no session cookie returned");
  }

  return {
    config,
    uid,
    executeKw: async (model, method, args = [], kwargs = {}) => {
      const res = await fetch(
        `${config.url}/web/dataset/call_kw/${model}/${method}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: cookie,
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "call",
            id: Date.now(),
            params: { model, method, args, kwargs },
          }),
        },
      );
      const json = (await res.json()) as {
        result?: unknown;
        error?: { data?: { message?: string }; message?: string };
      };
      if (json.error) {
        throw new Error(
          json.error.data?.message || json.error.message || "Odoo RPC failed",
        );
      }
      return json.result as never;
    },
  };
}
