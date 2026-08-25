import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { accountingMoney } from "@/components/accounting/accounting-nav";
import type { BalanceRow } from "@/types/accounting";

export function BalanceTable({
  title,
  rows,
  currency,
  total,
}: {
  title: string;
  rows: BalanceRow[];
  currency: string;
  total: string;
}) {
  return (
    <Card className="py-0">
      <CardHeader className="border-b py-4">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Account</TableHead>
            <TableHead>Name</TableHead>
            <TableHead className="text-right">Balance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.accountId}>
              <TableCell className="font-mono font-medium">
                {row.accountCode}
              </TableCell>
              <TableCell>{row.accountName}</TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {accountingMoney(row.balance, currency)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <CardContent className="flex justify-between border-t py-4 font-semibold">
        <span>Total {title.toLowerCase()}</span>
        <span className="font-mono tabular-nums">
          {accountingMoney(total, currency)}
        </span>
      </CardContent>
    </Card>
  );
}
