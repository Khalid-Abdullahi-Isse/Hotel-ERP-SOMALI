import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { getReportSummary } from "@/services/finance.server";

export const metadata: Metadata = { title: "Reports" };
export default async function ReportsPage() {
  const end = new Date(); end.setUTCDate(end.getUTCDate() + 1);
  const start = new Date(end); start.setUTCDate(start.getUTCDate() - 30);
  const summary = await getReportSummary(start.toISOString().slice(0, 10), end.toISOString().slice(0, 10));
  const metrics = [
    { label: "Revenue", value: formatCurrency(summary.revenue, summary.currency), detail: "last 30 days" },
    { label: "Expenses", value: formatCurrency(summary.expenses, summary.currency), detail: "last 30 days" },
    { label: "Outstanding", value: formatCurrency(summary.outstanding, summary.currency), detail: "current balance" },
    { label: "Average occupancy", value: `${summary.occupancy.toFixed(1)}%`, detail: "over 30 days" },
    { label: "Reservations", value: String(summary.reservations), detail: "arrivals in period" },
    { label: "Payments", value: String(summary.payments), detail: "transactions in period" },
  ];
  return <div className="space-y-6"><PageHeader title="Reports" description="Thirty-day operational and financial totals from saved records." /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{metrics.map((metric) => <Card key={metric.label} size="sm"><CardContent><p className="text-xs font-medium text-muted-foreground">{metric.label}</p><p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{metric.value}</p><p className="mt-1 text-[11px] text-muted-foreground">{metric.detail}</p></CardContent></Card>)}</div></div>;
}
