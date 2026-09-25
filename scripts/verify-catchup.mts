import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

for (const file of [".env.local", ".env"]) {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    )
      v = v.slice(1, -1);
    if (process.env[k] == null) process.env[k] = v;
  }
}

const sb = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

async function countLike(pattern: string, notLike?: string) {
  let q = sb
    .from("mail_messages")
    .select("id", { count: "exact", head: true })
    .like("message_id", pattern);
  if (notLike) q = q.not("message_id", "like", notLike);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

const previouslyMissing: number[] = JSON.parse(
  readFileSync("data/odoo-sale-msg-missing-ids.json", "utf8"),
);
const odooAll: number[] = JSON.parse(
  readFileSync("data/odoo-sale-msg-ids.json", "utf8"),
);

const stillMissing: number[] = [];
const found: number[] = [];

for (let i = 0; i < previouslyMissing.length; i += 80) {
  const chunk = previouslyMissing.slice(i, i + 80);
  const ids = chunk.map((id) => `odoo-sale-msg-${id}`);
  const { data, error } = await sb
    .from("mail_messages")
    .select("message_id")
    .in("message_id", ids);
  if (error) throw error;
  const have = new Set((data ?? []).map((r) => r.message_id));
  for (const id of chunk) {
    if (have.has(`odoo-sale-msg-${id}`)) found.push(id);
    else stillMissing.push(id);
  }
}

// Also re-diff full Odoo ID list vs CRM
const crmNums = new Set<number>();
let from = 0;
for (;;) {
  const { data, error } = await sb
    .from("mail_messages")
    .select("message_id")
    .like("message_id", "odoo-sale-msg-%")
    .range(from, from + 999);
  if (error) throw error;
  const rows = data ?? [];
  for (const r of rows) {
    const n = Number(String(r.message_id).replace(/^odoo-sale-msg-/, ""));
    if (Number.isFinite(n) && n < 900000000) crmNums.add(n);
  }
  if (rows.length < 1000) break;
  from += 1000;
}

const freshMissing = odooAll.filter((id) => !crmNums.has(id));

const samples = [214, 267759, 59341, 267761, 13315, 24865];
const sampleStatus: Record<string, string> = {};
for (const id of samples) {
  const { data } = await sb
    .from("mail_messages")
    .select("message_id, subject, preview, body_text")
    .eq("message_id", `odoo-sale-msg-${id}`)
    .maybeSingle();
  if (!data) sampleStatus[String(id)] = "MISSING";
  else
    sampleStatus[String(id)] =
      `OK subj=${(data.subject || "").slice(0, 40)} bodyLen=${(data.body_text || "").length} prev=${(data.preview || "").slice(0, 40)}`;
}

const orphan = await countLike("odoo-sale-msg-900000%");
const real = await countLike("odoo-sale-msg-%", "odoo-sale-msg-900000%");
const all = await countLike("odoo-sale-msg-%");

const result = {
  odooSaleMsgIds: odooAll.length,
  crmRealSaleMsgs: real,
  crmOrphanBundles: orphan,
  crmAllSaleMsgRows: all,
  crmUniqueRealNums: crmNums.size,
  previouslyMissing: previouslyMissing.length,
  nowFoundFromPrevious: found.length,
  stillMissingFromPrevious: stillMissing.length,
  stillMissingIds: stillMissing.slice(0, 80),
  freshMissingVsOdooList: freshMissing.length,
  freshMissingIds: freshMissing.slice(0, 80),
  sampleStatus,
};
writeFileSync("data/odoo-sale-msg-verify.json", JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
