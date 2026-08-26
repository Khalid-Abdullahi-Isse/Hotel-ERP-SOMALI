import type { Metadata } from "next";
import { AccountingNav } from "@/components/accounting/accounting-nav";
import { accountingPeriod } from "@/lib/accounting";
import { ReportPeriod } from "@/components/accounting/report-period";
import { ListToolbar } from "@/components/shared/list-toolbar";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { parsePage } from "@/lib/pagination";
import { getGeneralLedger } from "@/services/accounting.server";

export const metadata: Metadata = { title: "General Ledger" };
export default async function GeneralLedgerPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  }>;
}) {
  const params = await searchParams;
  const defaults = accountingPeriod();
  const dateFrom = params.dateFrom ?? defaults.dateFrom;
  const dateTo = params.dateTo ?? defaults.dateTo;
  const ledger = await getGeneralLedger({
    page: parsePage(params.page),
    search: params.search,
    dateFrom,
    dateTo,
  });
  return (
    <div className="space-y-6">
      <PageHeader
        title="General Ledger"
        description="Posted journal lines with account-level running balances."
        actions={<ReportPeriod dateFrom={dateFrom} dateTo={dateTo} />}
      />
      <AccountingNav />
      <Card className="py-0">
        <ListToolbar placeholder="Search entry, account, reference, or description" />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Entry</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Credit</TableHead>
              <TableHead className="text-right">Running balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ledger.data.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground">No posted ledger lines match this period and search.</TableCell></TableRow>
            ) : null}
            {ledger.data.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.businessDate}</TableCell>
                <TableCell className="font-mono">{row.entryNumber}</TableCell>
                <TableCell>
                  <p className="font-mono font-medium">{row.accountCode}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.accountName}
                  </p>
                </TableCell>
                <TableCell className="max-w-80 truncate">
                  {row.description}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {row.debit}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {row.credit}
                </TableCell>
                <TableCell className="text-right font-mono font-medium tabular-nums">
                  {row.runningBalance}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pagination
          {...ledger.pagination}
          itemLabel="ledger lines"
          searchParams={{ search: params.search, dateFrom, dateTo }}
        />
      </Card>
    </div>
  );
}
