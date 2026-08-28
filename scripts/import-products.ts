/**
 * Import Odoo products from data/odoo-products.json into Supabase.
 *
 * Usage:
 *   npx tsx scripts/import-products.ts
 *
 * Requires .env.local and products table (run supabase/schema.sql once).
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getSupabase } from "../lib/supabase/server";

const FILE_CANDIDATES = [
  resolve(process.cwd(), "data", "odoo-products.json"),
  resolve(process.cwd(), "lib", "seed", "odoo-products.json"),
];

function loadLocalEnv() {
  for (const file of [".env.local", ".env"]) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] == null) process.env[key] = value;
    }
  }
}

type Row = {
  odoo_id: number;
  name: string;
  reference?: string;
  category?: string;
  type: "service" | "consu" | "product";
  sale_ok?: boolean;
  active?: boolean;
  list_price: number;
  currency?: "EUR" | "USD";
  qty_on_hand?: number;
  variant_count?: number;
  description?: string;
};

async function main() {
  loadLocalEnv();
  const file = FILE_CANDIDATES.find((path) => existsSync(path));
  if (!file) {
    throw new Error(
      `Missing odoo-products.json (checked: ${FILE_CANDIDATES.join(", ")})`,
    );
  }
  const raw = JSON.parse(readFileSync(file, "utf8")) as Row[];
  const sb = getSupabase();

  const rows = raw.map((row) => ({
    id: `prod_odoo_${row.odoo_id}`,
    odoo_id: row.odoo_id,
    name: row.name.trim(),
    reference: row.reference?.trim() ?? "",
    category: row.category?.trim() ?? "",
    type: row.type,
    sale_ok: row.sale_ok ?? true,
    active: row.active ?? true,
    list_price: row.list_price,
    currency: row.currency ?? "EUR",
    qty_on_hand: row.qty_on_hand ?? 0,
    variant_count: row.variant_count ?? 1,
    description: row.description?.trim() ?? "",
  }));

  const { error } = await sb.from("products").upsert(rows, { onConflict: "odoo_id" });
  if (error) {
    if (/products/.test(error.message) && /schema cache|does not exist/i.test(error.message)) {
      console.error(
        "Products table missing. Run supabase/products.sql in Supabase → SQL Editor, then retry.",
      );
    }
    throw new Error(error.message);
  }

  console.log(JSON.stringify({ imported: rows.length, file }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
