import type { Metadata } from "next";
import { AccountingNav } from "@/components/accounting/accounting-nav";
import { accountingMoney, accountingPeriod } from "@/lib/accounting";
import { BalanceTable } from "@/components/accounting/balance-table";
import { ReportPeriod } from "@/components/accounting/report-period";
import { PageHeader } from "@/components/shared/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getBalanceSheet } from "@/services/accounting.server";

export const metadata: Metadata = { title: "Balance Sheet" };
export default async function BalanceSheetPage({
  searchParams,
}: {
  searchParams: Promise<{ dateTo?: string }>;
}) {
  const params = await searchParams;
  const dateTo = params.dateTo ?? accountingPeriod().dateTo;
  const report = await getBalanceSheet(dateTo);
  const currency = report.report.currency;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Balance Sheet"
        description="Assets, liabilities, equity, and current profit as of the selected business date."
        actions={<ReportPeriod dateFrom="" dateTo={dateTo} showFrom={false} />}
      />
      <AccountingNav />
      {report.warning ? (
        <Alert variant="destructive">
          <AlertTitle>Accounting equation imbalance</AlertTitle>
          <AlertDescription>
            Assets differ from liabilities plus equity by{" "}
            {report.totals.difference}. Investigate before relying on this
            statement.
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-3">
        <BalanceTable
          title="Assets"
          rows={report.assets}
          total={report.totals.assets}
          currency={currency}
        />
        <BalanceTable
          title="Liabilities"
          rows={report.liabilities}
          total={report.totals.liabilities}
          currency={currency}
        />
        <BalanceTable
          title="Equity"
          rows={report.equity}
          total={report.totals.equity}
          currency={currency}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Current profit / loss included in equity</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-semibold tabular-nums">
          {accountingMoney(report.totals.currentProfitLoss, currency)}
        </CardContent>
      </Card>
    </div>
  );
}
