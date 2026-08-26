import type { Metadata } from "next";
import { AccountingNav } from "@/components/accounting/accounting-nav";
import { accountingPeriod } from "@/lib/accounting";
import { ReportPeriod } from "@/components/accounting/report-period";
import { PageHeader } from "@/components/shared/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getTrialBalance } from "@/services/accounting.server";

export const metadata: Metadata = { title: "Trial Balance" };
export default async function TrialBalancePage({
  searchParams,
}: {
  searchParams: Promise<{ dateFrom?: string; dateTo?: string }>;
}) {
  const params = await searchParams;
  const defaults = accountingPeriod();
  const dateFrom = params.dateFrom ?? defaults.dateFrom;
  const dateTo = params.dateTo ?? defaults.dateTo;
  const report = await getTrialBalance(dateFrom, dateTo);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Trial Balance"
        description="Opening balances and period movements derived from posted entries."
        actions={<ReportPeriod dateFrom={dateFrom} dateTo={dateTo} />}
      />
      <AccountingNav />
      {report.warning ? (
        <Alert variant="destructive">
          <AlertTitle>Accounting imbalance detected</AlertTitle>
          <AlertDescription>
            Debit and credit totals differ by {report.totals.difference}.
            Posting should stop until this is investigated.
          </AlertDescription>
        </Alert>
      ) : null}
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Opening</TableHead>
              <TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Credit</TableHead>
              <TableHead className="text-right">Closing</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.data.map((row) => (
              <TableRow key={row.accountId}>
                <TableCell className="font-mono font-medium">
                  {row.accountCode}
                </TableCell>
                <TableCell>{row.accountName}</TableCell>
                <TableCell className="text-right font-mono">
                  {row.openingBalance}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {row.debit}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {row.credit}
                </TableCell>
                <TableCell className="text-right font-mono font-medium">
                  {row.closingBalance}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={3}>Totals</TableCell>
              <TableCell className="text-right font-mono">
                {report.totals.debit}
              </TableCell>
              <TableCell className="text-right font-mono">
                {report.totals.credit}
              </TableCell>
              <TableCell className="text-right font-mono">
                Difference {report.totals.difference}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
        <CardContent className="border-t py-3 text-xs text-muted-foreground">
          Report ID {report.report.reportId} · {report.report.currency} ·{" "}
          {report.report.status}
        </CardContent>
      </Card>
    </div>
  );
}
