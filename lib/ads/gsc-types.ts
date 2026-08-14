export type GscMetrics = {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type GscSnapshot = GscMetrics & {
  id: string;
  siteUrl: string;
  dateFrom: string;
  dateTo: string;
  syncedAt: string;
};

export type GscDailyRow = GscMetrics & { date: string };
export type GscQueryRow = GscMetrics & { query: string };
export type GscPageRow = GscMetrics & { page: string };

export type GscSyncInfo = {
  status: "ok" | "error";
  finishedAt: string | null;
  error: string | null;
};

export type GscPayload = {
  snapshot: GscSnapshot | null;
  daily: GscDailyRow[];
  queries: GscQueryRow[];
  pages: GscPageRow[];
  lastSync: GscSyncInfo | null;
};

export type ApiErrorBody = {
  error: string;
  code: "missing_credentials" | "sync_failed";
  missing?: string[];
};
