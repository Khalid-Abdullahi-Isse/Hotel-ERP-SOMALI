import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { AccountingNav } from "@/components/accounting/accounting-nav";
import { TransactionToolbar } from "@/components/accounting/transaction-toolbar";
import { TransactionList } from "@/components/accounting/transaction-list";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { parsePage } from "@/lib/pagination";
import { getJournalEntries } from "@/services/accounting.server";
import { getCurrentUser } from "@/services/auth.server";
import { PERMISSIONS } from "@/constants/permissions";
import { can } from "@/lib/permissions";

export const metadata: Metadata = { title: "Accounting Transactions" };

export default async function JournalEntriesPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    search?: string;
    status?: string;
    description?: string;
    accountCode?: string;
    currency?: string;
    dateFrom?: string;
    dateTo?: string;
    order?: string;
  }>;
}) {
  const params = await searchParams;
  const [entries, user] = await Promise.all([
    getJournalEntries({
      page: parsePage(params.page),
      search: params.search,
      status: params.status?.toUpperCase(),
      accountCode: params.accountCode,
      currency: params.currency,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      order: params.order === "desc" ? "desc" : "asc",
    }),
    getCurrentUser(),
  ]);

  const baseCurrency =
    entries.data[0]?.lines?.[0]?.currency ?? "USD";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounting Transactions"
        description="Every journal entry and its individual accounting lines, as they exist in the database."
        actions={
          user && can(user, PERMISSIONS.journalsPost) ? (
            <Button asChild>
              <Link href="/accounting/journal-entries/new">
                <Plus />
                New entry
              </Link>
            </Button>
          ) : null
        }
      />
      <AccountingNav />
      <Card className="py-0">
        <TransactionToolbar
          placeholder="Search entry, reference, or description"
          statuses={[
            { value: "draft", label: "Draft" },
            { value: "posted", label: "Posted" },
            { value: "reversed", label: "Reversed" },
          ]}
        />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Entry</TableHead>
              <TableHead>Posting date</TableHead>
              <TableHead>Journal</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Credit</TableHead>
            </TableRow>
          </TableHeader>
          <TransactionList entries={entries.data} baseCurrency={baseCurrency} />
        </Table>
        <Pagination
          {...entries.pagination}
          itemLabel="transactions"
          searchParams={{
            search: params.search,
            status: params.status,
            accountCode: params.accountCode,
            currency: params.currency,
            dateFrom: params.dateFrom,
            dateTo: params.dateTo,
            order: params.order,
          }}
        />
      </Card>
      <p className="text-xs text-muted-foreground">
        Expand any transaction to see every debit and credit journal line
        individually. Different transactions are never merged.
      </p>
    </div>
  );
}
