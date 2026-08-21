import { redirect } from "next/navigation";

/** Combined analytics (Meta) stays paused — organic search lives at Search Console. */
export default function AnalyticsPage() {
  redirect("/search-console");
}
