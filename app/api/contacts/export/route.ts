import { jsonError } from "@/lib/api";
import {
  detectClientLanguage,
  type ClientLanguage,
} from "@/lib/crm/client-language";
import { parseLeadDetails } from "@/lib/crm/contact-details";
import type { Lead } from "@/lib/demo-data";
import { getSupabase, missingSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function escapeCsv(val: unknown): string {
  if (val == null) return '""';
  const s = String(val).replace(/"/g, '""');
  return `"${s}"`;
}

function toCsvRow(cells: (string | number | null | undefined)[]): string {
  return cells.map(escapeCsv).join(",");
}

const CSV_HEADERS = [
  "ID",
  "Name",
  "Email",
  "Phone",
  "Company",
  "Country",
  "City",
  "Language Code",
  "Language Label",
  "Confidence",
  "Detection Reason",
  "Status",
  "Value (USD)",
  "Total Messages Exchanged",
  "Created At",
  "Last Contact",
];

export async function GET(req: Request) {
  const missing = missingSupabaseEnv();
  if (missing.length > 0) {
    return jsonError(503, {
      error: "Supabase credentials missing",
      code: "missing_credentials",
      missing,
    });
  }

  const url = new URL(req.url);
  const targetLang = (url.searchParams.get("lang") || "all").toLowerCase();

  const validLangs = new Set(["en", "fr", "es", "all", "unknown"]);
  if (!validLangs.has(targetLang)) {
    return jsonError(400, {
      error: "Invalid lang parameter. Use en, fr, es, or all.",
      code: "bad_request",
    });
  }

  try {
    const sb = getSupabase();

    // 1. Fetch leads
    const leads: Lead[] = [];
    let from = 0;
    const PAGE = 1000;
    while (true) {
      const { data, error } = await sb
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, from + PAGE - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;
      leads.push(...(data as Lead[]));
      from += PAGE;
    }

    // 2. Index message histories
    const messageTextsByEmail = new Map<string, string[]>();
    const messageCountByEmail = new Map<string, number>();

    let msgFrom = 0;
    while (true) {
      const { data, error } = await sb
        .from("mail_messages")
        .select("from_email, subject, body_text")
        .range(msgFrom, msgFrom + PAGE - 1);

      if (error || !data || data.length === 0) break;
      for (const m of data) {
        const email = (m.from_email || "").toLowerCase().trim();
        if (!email) continue;
        if (!messageTextsByEmail.has(email)) messageTextsByEmail.set(email, []);
        messageTextsByEmail.get(email)!.push(`${m.subject || ""} ${m.body_text || ""}`);
        messageCountByEmail.set(email, (messageCountByEmail.get(email) || 0) + 1);
      }
      msgFrom += PAGE;
    }

    const { data: replies } = await sb
      .from("mail_replies")
      .select("to_email, subject, body_text");

    for (const r of replies || []) {
      const email = (r.to_email || "").toLowerCase().trim();
      if (!email) continue;
      if (!messageTextsByEmail.has(email)) messageTextsByEmail.set(email, []);
      messageTextsByEmail.get(email)!.push(`${r.subject || ""} ${r.body_text || ""}`);
      messageCountByEmail.set(email, (messageCountByEmail.get(email) || 0) + 1);
    }

    // 3. Classify and filter
    const labelMap: Record<ClientLanguage, string> = {
      en: "English",
      fr: "Français (French)",
      es: "Español (Spanish)",
      unknown: "Unclassified",
    };

    const rows: string[] = [toCsvRow(CSV_HEADERS)];

    for (const lead of leads) {
      const email = (lead.email || "").toLowerCase().trim();
      const thread = messageTextsByEmail.get(email)?.join("\n\n") || "";
      const msgCount = messageCountByEmail.get(email) || 0;

      const details = parseLeadDetails(lead);
      const detection = detectClientLanguage(lead, {
        messagesText: thread,
        explicitCountry: details.country,
      });

      if (targetLang !== "all" && detection.language !== targetLang) {
        continue;
      }

      rows.push(
        toCsvRow([
          lead.id,
          lead.name,
          lead.email,
          lead.phone,
          lead.company,
          details.country || "",
          details.city || "",
          detection.language.toUpperCase(),
          labelMap[detection.language],
          detection.confidence,
          detection.reason,
          lead.status,
          lead.value,
          msgCount,
          lead.createdAt ||
            String((lead as Lead & { created_at?: string }).created_at ?? ""),
          lead.lastContact ||
            String((lead as Lead & { last_contact?: string }).last_contact ?? ""),
        ]),
      );
    }

    const langNameMap: Record<string, string> = {
      en: "english",
      fr: "french",
      es: "spanish",
      all: "all_sorted",
      unknown: "unclassified",
    };

    const filename = `clients_${langNameMap[targetLang] || targetLang}.csv`;

    // UTF-8 BOM (\uFEFF) ensures Excel displays accents properly
    const csvData = "\uFEFF" + rows.join("\r\n");

    return new Response(csvData, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Export failed";
    return jsonError(500, { error: message, code: "db_error" });
  }
}
