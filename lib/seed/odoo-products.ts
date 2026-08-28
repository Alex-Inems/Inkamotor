import seed from "@/lib/seed/odoo-products.json";
import type { Product, ProductType } from "@/lib/demo-data";

type SeedRow = {
  odoo_id: number;
  name: string;
  reference?: string;
  category?: string;
  type: ProductType;
  sale_ok?: boolean;
  active?: boolean;
  list_price: number;
  currency?: "EUR" | "USD";
  qty_on_hand?: number;
  variant_count?: number;
  description?: string;
};

export function seedOdooProducts(): Product[] {
  return (seed as SeedRow[]).map((row) => ({
    id: `prod_odoo_${row.odoo_id}`,
    odooId: row.odoo_id,
    name: row.name.trim(),
    reference: row.reference?.trim() ?? "",
    category: row.category?.trim() ?? "",
    type: row.type,
    saleOk: row.sale_ok ?? true,
    active: row.active ?? true,
    listPrice: row.list_price,
    currency: row.currency ?? "EUR",
    qtyOnHand: row.qty_on_hand ?? 0,
    variantCount: row.variant_count ?? 1,
    description: row.description?.trim() ?? "",
  }));
}
