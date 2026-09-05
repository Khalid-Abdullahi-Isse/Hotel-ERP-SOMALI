import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportPeriod } from "@/components/accounting/report-period";
import { formatCurrency } from "@/lib/format";
import { getReportSummary } from "@/services/finance.server";

export const metadata: Metadata = { title: "Reports" };

function getDefaultDates() {
  const to = new Date();
  to.setUTCDate(to.getUTCDate() + 1);
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 30);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ dateFrom?: string; dateTo?: string }>;
}) {
  const params = await searchParams;
  const defaults = getDefaultDates();
  const dateFrom =
    params.dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(params.dateFrom)
      ? params.dateFrom
      : defaults.from;
  const dateTo =
    params.dateTo && /^\d{4}-\d{2}-\d{2}$/.test(params.dateTo)
      ? params.dateTo
      : defaults.to;

  const summary = await getReportSummary(dateFrom, dateTo);

  const financialMetrics = [
    {
      label: "Revenue",
      value: formatCurrency(summary.revenue, summary.currency),
      detail: "total in period",
    },
    {
      label: "Expenses",
      value: formatCurrency(summary.expenses, summary.currency),
      detail: "total in period",
    },
    {
      label: "Net",
      value: formatCurrency(
        summary.revenue - summary.expenses,
        summary.currency,
      ),
      detail: "revenue minus expenses",
    },
    {
      label: "Outstanding",
      value: formatCurrency(summary.outstanding, summary.currency),
      detail: "current balance",
    },
  ];

  const operationalMetrics = [
    {
      label: "Average occupancy",
      value: `${summary.occupancy.toFixed(1)}%`,
      detail: "over period",
    },
    {
      label: "Reservations",
      value: String(summary.reservations),
      detail: "arrivals in period",
    },
    {
      label: "Payments",
      value: String(summary.payments),
      detail: "transactions in period",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Operational and financial totals from saved records."
        actions={
          <ReportPeriod
            dateFrom={dateFrom}
            dateTo={dateTo}
          />
        }
      />

      <Card>
        <CardHeader className="border-b py-4">
          <CardTitle>Financial summary</CardTitle>
          <p className="text-xs text-muted-foreground">
            {dateFrom} to {dateTo}
          </p>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {financialMetrics.map((metric) => (
              <div key={metric.label} className="rounded-lg border p-4">
                <p className="text-xs font-medium text-muted-foreground">
                  {metric.label}
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
                  {metric.value}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {metric.detail}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b py-4">
          <CardTitle>Operational summary</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {operationalMetrics.map((metric) => (
              <div key={metric.label} className="rounded-lg border p-4">
                <p className="text-xs font-medium text-muted-foreground">
                  {metric.label}
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
                  {metric.value}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {metric.detail}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
