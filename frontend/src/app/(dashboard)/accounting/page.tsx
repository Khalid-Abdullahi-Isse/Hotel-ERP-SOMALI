import type { Metadata } from "next";
import { BookOpen, Landmark, Scale, TrendingUp } from "lucide-react";
import {
  AccountingNav,
  accountingMoney,
  accountingPeriod,
} from "@/components/accounting/accounting-nav";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getAccountingAccounts,
  getBalanceSheet,
  getProfitLoss,
} from "@/services/accounting.server";

export const metadata: Metadata = { title: "Accounting" };

export default async function AccountingPage() {
  const period = accountingPeriod();
  const [accounts, profitLoss, balanceSheet] = await Promise.all([
    getAccountingAccounts({ page: 1 }),
    getProfitLoss(period.dateFrom, period.dateTo),
    getBalanceSheet(period.dateTo),
  ]);
  const currency = profitLoss.report.currency;
  const metrics = [
    { label: "Revenue", value: profitLoss.totals.revenue, icon: TrendingUp },
    {
      label: "Net profit / loss",
      value: profitLoss.totals.netProfitLoss,
      icon: Scale,
    },
    { label: "Assets", value: balanceSheet.totals.assets, icon: Landmark },
    {
      label: "Ledger accounts",
      value: String(accounts.pagination.total),
      icon: BookOpen,
      count: true,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounting"
        description="Posted double-entry ledger results for the current business month."
      />
      <AccountingNav />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <CardHeader className="grid grid-cols-[1fr_auto] items-center">
              <CardTitle className="text-sm text-muted-foreground">
                {metric.label}
              </CardTitle>
              <metric.icon className="size-4 text-primary" aria-hidden="true" />
            </CardHeader>
            <CardContent className="text-2xl font-semibold tabular-nums">
              {metric.count
                ? Number(metric.value).toLocaleString()
                : accountingMoney(metric.value, currency)}
            </CardContent>
          </Card>
        ))}
      </div>
      {accounts.pagination.total === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="font-medium">
              Accounting has not been initialized for this hotel.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              A user with accounting management permission must initialize the
              chart and mappings before posting entries.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
