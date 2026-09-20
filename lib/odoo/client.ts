import { missingEnv } from "@/lib/api";

const ODOO_KEYS = ["ODOO_URL", "ODOO_DB", "ODOO_API_KEY"] as const;

export type OdooConfig = {
  url: string;
  db: string;
  apiKey: string;
};

export function missingOdooEnv(): string[] {
  return missingEnv([...ODOO_KEYS]);
}

export function readOdooConfig(): OdooConfig {
  const missing = missingOdooEnv();
  if (missing.length) {
    throw new Error(`Missing Odoo env: ${missing.join(", ")}`);
  }
  return {
    url: process.env.ODOO_URL!.trim().replace(/\/$/, ""),
    db: process.env.ODOO_DB!.trim(),
    apiKey: process.env.ODOO_API_KEY!.trim(),
  };
}

export type OdooClient = {
  config: OdooConfig;
  executeKw: <T>(
    model: string,
    method: string,
    args?: unknown[],
    kwargs?: Record<string, unknown>,
  ) => Promise<T>;
};

/**
 * Odoo 19+ External JSON-2 API.
 * @see https://www.odoo.com/documentation/19.0/developer/reference/external_api.html
 */
export async function connectOdoo(config = readOdooConfig()): Promise<OdooClient> {
  // Validate the API key with a lightweight call.
  const probe = await fetch(`${config.url}/json/2/res.users/context_get`, {
    method: "POST",
    headers: {
      Authorization: `bearer ${config.apiKey}`,
      "Content-Type": "application/json; charset=utf-8",
      "X-Odoo-Database": config.db,
      "User-Agent": "inkamoto-crm/1.0",
    },
    body: JSON.stringify({}),
  });
  if (!probe.ok) {
    const text = await probe.text();
    let detail = text.slice(0, 300);
    try {
      const json = JSON.parse(text) as { message?: string };
      if (json.message) detail = json.message;
    } catch {
      /* keep text */
    }
    throw new Error(
      `Odoo auth failed (${probe.status}): ${detail}. ` +
        `Create an API key in Odoo → Preferences → Account Security. ` +
        `Note: External API requires a Custom pricing plan.`,
    );
  }

  return {
    config,
    executeKw: async (model, method, args = [], kwargs = {}) => {
      // JSON-2 uses named params. Map common ORM calls.
      const body: Record<string, unknown> = {
        context: { lang: "en_US" },
        ...kwargs,
      };

      if (method === "search_read") {
        body.domain = args[0] ?? [];
      } else if (method === "search") {
        body.domain = args[0] ?? [];
      } else if (method === "read") {
        body.ids = args[0] ?? [];
      } else if (args.length > 0) {
        body.ids = Array.isArray(args[0]) ? args[0] : [];
        if (args.length > 1 && typeof args[1] === "object") {
          Object.assign(body, args[1] as object);
        }
      }

      const res = await fetch(`${config.url}/json/2/${model}/${method}`, {
        method: "POST",
        headers: {
          Authorization: `bearer ${config.apiKey}`,
          "Content-Type": "application/json; charset=utf-8",
          "X-Odoo-Database": config.db,
          "User-Agent": "inkamoto-crm/1.0",
        },
        body: JSON.stringify(body),
      });

      const text = await res.text();
      let parsed: unknown = text;
      try {
        parsed = JSON.parse(text);
      } catch {
        /* keep text */
      }
      if (!res.ok) {
        const msg =
          typeof parsed === "object" &&
          parsed &&
          "message" in parsed &&
          typeof (parsed as { message: unknown }).message === "string"
            ? (parsed as { message: string }).message
            : text.slice(0, 400);
        throw new Error(`Odoo ${model}.${method} failed (${res.status}): ${msg}`);
      }
      return parsed as never;
    },
  };
}
