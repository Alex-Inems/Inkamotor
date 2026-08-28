import type { SaleStatus } from "@/lib/demo-data";

export type SalePipelineStage = {
  id: SaleStatus;
  folded: boolean;
};

/** Odoo Sales default quotation pipeline (draft → sent → sale). */
export const ODOO_SALE_STAGES: SalePipelineStage[] = [
  { id: "pending", folded: false },
  { id: "sent", folded: false },
  { id: "confirmed", folded: false },
  { id: "fulfilled", folded: true },
  { id: "cancelled", folded: true },
];

export const SALE_STAGE_IDS = ODOO_SALE_STAGES.map((s) => s.id);

export function isSaleStageId(id: string): id is SaleStatus {
  return (SALE_STAGE_IDS as readonly string[]).includes(id);
}
