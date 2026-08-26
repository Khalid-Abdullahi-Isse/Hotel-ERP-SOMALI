import type { Metadata } from "next";
import { AccountingNav } from "@/components/accounting/accounting-nav";
import { accountingMoney, accountingPeriod } from "@/lib/accounting";
import { BalanceTable } from "@/components/accounting/balance-table";
import { ReportPeriod } from "@/components/accounting/report-period";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getProfitLoss } from "@/services/accounting.server";

export const metadata: Metadata = { title: "Profit & Loss" };
export default async function ProfitLossPage({
  searchParams,
}: {
  searchParams: Promise<{ dateFrom?: string; dateTo?: string }>;
}) {
  const params = await searchParams;
  const defaults = accountingPeriod();
  const dateFrom = params.dateFrom ?? defaults.dateFrom;
  const dateTo = params.dateTo ?? defaults.dateTo;
  const report = await getProfitLoss(dateFrom, dateTo);
  const currency = report.report.currency;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Profit & Loss"
        description="Earned revenue and expenses from the posted ledger—not payment collections."
        actions={<ReportPeriod dateFrom={dateFrom} dateTo={dateTo} />}
      />
      <AccountingNav />
      <div className="grid gap-6 xl:grid-cols-2">
        <BalanceTable
          title="Revenue"
          rows={report.revenue}
          total={report.totals.revenue}
          currency={currency}
        />
        <BalanceTable
          title="Expenses"
          rows={report.expenses}
          total={report.totals.expenses}
          currency={currency}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Net profit / loss</CardTitle>
        </CardHeader>
        <CardContent className="text-3xl font-semibold tabular-nums">
          {accountingMoney(report.totals.netProfitLoss, currency)}
        </CardContent>
      </Card>
    </div>
  );
}
