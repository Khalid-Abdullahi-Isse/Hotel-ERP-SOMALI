import type { Metadata } from "next";
import { CheckCircle, AlertTriangle } from "lucide-react";
import { AccountingNav } from "@/components/accounting/accounting-nav";
import {
  accountingMoney,
  accountingPeriod,
  normalizeAccountingDate,
} from "@/lib/accounting";
import { ReportPeriod } from "@/components/accounting/report-period";
import { PageHeader } from "@/components/shared/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import type { TrialBalanceRow } from "@/types/accounting";

export const metadata: Metadata = { title: "Trial Balance" };

function isZeroBalance(row: TrialBalanceRow) {
  const zero = (v: unknown) => v === "0.00" || v === "0" || v === 0 || v === "0.0000";
  return (
    zero(row.openingDebit) &&
    zero(row.openingCredit) &&
    zero(row.periodDebit) &&
    zero(row.periodCredit) &&
    zero(row.closingDebit) &&
    zero(row.closingCredit)
  );
}

export default async function TrialBalancePage({
  searchParams,
}: {
  searchParams: Promise<{
    dateFrom?: string;
    dateTo?: string;
    hideZero?: string;
  }>;
}) {
  const params = await searchParams;
  const defaults = accountingPeriod();
  const dateFrom = normalizeAccountingDate(params.dateFrom, defaults.dateFrom);
  const dateTo = normalizeAccountingDate(params.dateTo, defaults.dateTo);
  const hideZero = params.hideZero === "1";
  const currency = (await getTrialBalance(dateFrom, dateTo)).report.currency;
  const report = await getTrialBalance(dateFrom, dateTo);
  const rows = hideZero ? report.data.filter((r) => !isZeroBalance(r)) : report.data;
  const t = report.totals;

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
            Debit and credit totals differ by{" "}
            {accountingMoney(report.totals.difference, currency)}. Posting
            should stop until this is investigated.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex items-center gap-2 text-sm">
        <form method="get" className="flex items-center gap-2">
          <input type="hidden" name="dateFrom" value={dateFrom} />
          <input type="hidden" name="dateTo" value={dateTo} />
          <input type="hidden" name="hideZero" value={hideZero ? "0" : "1"} />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-muted"
          >
            {hideZero ? "Show" : "Hide"} zero balances
          </button>
        </form>
      </div>

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Opening Dr</TableHead>
              <TableHead className="text-right">Opening Cr</TableHead>
              <TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Credit</TableHead>
              <TableHead className="text-right">Closing Dr</TableHead>
              <TableHead className="text-right">Closing Cr</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="h-32 text-center text-muted-foreground"
                >
                  No posted account activity is available for this period.
                </TableCell>
              </TableRow>
            ) : null}
            {rows.map((row) => (
              <TableRow key={row.accountId}>
                <TableCell className="font-mono font-medium">
                  {row.accountCode}
                </TableCell>
                <TableCell>{row.accountName}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px]">
                    {row.accountType}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {row.openingDebit !== "0.00"
                    ? accountingMoney(row.openingDebit, currency)
                    : ""}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {row.openingCredit !== "0.00"
                    ? accountingMoney(row.openingCredit, currency)
                    : ""}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {row.periodDebit !== "0.00"
                    ? accountingMoney(row.periodDebit, currency)
                    : ""}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {row.periodCredit !== "0.00"
                    ? accountingMoney(row.periodCredit, currency)
                    : ""}
                </TableCell>
                <TableCell className="text-right font-mono font-medium tabular-nums">
                  {row.closingDebit !== "0.00"
                    ? accountingMoney(row.closingDebit, currency)
                    : ""}
                </TableCell>
                <TableCell className="text-right font-mono font-medium tabular-nums">
                  {row.closingCredit !== "0.00"
                    ? accountingMoney(row.closingCredit, currency)
                    : ""}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow className="font-semibold">
              <TableCell colSpan={3}>Totals</TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {accountingMoney(t.openingDebit, currency)}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {accountingMoney(t.openingCredit, currency)}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {accountingMoney(t.periodDebit, currency)}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {accountingMoney(t.periodCredit, currency)}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {accountingMoney(t.closingDebit, currency)}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {accountingMoney(t.closingCredit, currency)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
        <CardContent className="border-t py-3 text-xs text-muted-foreground">
          Report ID {report.report.reportId} · {report.report.currency} ·{" "}
          {report.report.status}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center gap-3 py-4">
          {report.totals.balanced ? (
            <>
              <div className="grid size-10 place-items-center rounded-xl bg-green-500/10 text-green-600">
                <CheckCircle className="size-5" />
              </div>
              <div>
                <p className="font-semibold text-green-700">
                  Trial Balance is Balanced
                </p>
                <p className="text-sm text-muted-foreground">
                  Total debits and credits are equal.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="grid size-10 place-items-center rounded-xl bg-destructive/10 text-destructive">
                <AlertTriangle className="size-5" />
              </div>
              <div>
                <p className="font-semibold text-destructive">
                  Trial Balance is NOT Balanced
                </p>
                <p className="text-sm text-muted-foreground">
                  Debit total:{" "}
                  {accountingMoney(t.closingDebit, currency)} · Credit total:{" "}
                  {accountingMoney(t.closingCredit, currency)} · Difference:{" "}
                  {accountingMoney(t.difference, currency)}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
