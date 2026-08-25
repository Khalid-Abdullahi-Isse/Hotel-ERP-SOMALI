import type { Metadata } from "next";
import { AccountingNav } from "@/components/accounting/accounting-nav";
import { ListToolbar } from "@/components/shared/list-toolbar";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { Badge } from "@/components/ui/badge";
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
import { getAccountingAccounts } from "@/services/accounting.server";

export const metadata: Metadata = { title: "Chart of Accounts" };
export default async function ChartOfAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string }>;
}) {
  const params = await searchParams;
  const accounts = await getAccountingAccounts({
    page: parsePage(params.page),
    search: params.search,
  });
  return (
    <div className="space-y-6">
      <PageHeader
        title="Chart of Accounts"
        description="Hotel-scoped ledger accounts and posting controls."
      />
      <AccountingNav />
      <Card className="py-0">
        <ListToolbar placeholder="Search account code or name" />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Normal balance</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.data.map((account) => (
              <TableRow key={account.id}>
                <TableCell className="font-mono font-medium">
                  {account.code}
                </TableCell>
                <TableCell>
                  <p className="font-medium">{account.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {account.parent
                      ? `Under ${account.parent.code} · ${account.parent.name}`
                      : "Top-level account"}
                  </p>
                </TableCell>
                <TableCell>{account.type}</TableCell>
                <TableCell>{account.normalBalance}</TableCell>
                <TableCell>
                  <Badge variant={account.isActive ? "secondary" : "outline"}>
                    {account.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pagination
          {...accounts.pagination}
          itemLabel="accounts"
          searchParams={{ search: params.search }}
        />
      </Card>
    </div>
  );
}
