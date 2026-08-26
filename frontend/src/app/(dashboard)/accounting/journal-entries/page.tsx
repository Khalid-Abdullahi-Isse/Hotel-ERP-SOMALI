import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { AccountingNav } from "@/components/accounting/accounting-nav";
import { ListToolbar } from "@/components/shared/list-toolbar";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { getJournalEntries } from "@/services/accounting.server";
import { getCurrentUser } from "@/services/auth.server";
import { PERMISSIONS } from "@/constants/permissions";
import { can } from "@/lib/permissions";

export const metadata: Metadata = { title: "Journal Entries" };
export default async function JournalEntriesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; status?: string }>;
}) {
  const params = await searchParams;
  const [entries, user] = await Promise.all([getJournalEntries({ page: parsePage(params.page), search: params.search, status: params.status?.toUpperCase() }), getCurrentUser()]);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Journal Entries"
        description="Immutable posted entries, drafts, and linked reversals."
        actions={user && can(user, PERMISSIONS.journalsPost) ? <Button asChild><Link href="/accounting/journal-entries/new"><Plus />New entry</Link></Button> : null}
      />
      <AccountingNav />
      <Card className="py-0">
        <ListToolbar
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
              <TableHead>Entry</TableHead>
              <TableHead>Business date</TableHead>
              <TableHead>Journal</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Credit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.data.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="font-mono font-medium text-primary">
                  <Link href={`/accounting/journal-entries/${entry.id}`} className="hover:underline">{entry.entryNumber}</Link>
                </TableCell>
                <TableCell>{entry.businessDate.slice(0, 10)}</TableCell>
                <TableCell>{entry.journal.code}</TableCell>
                <TableCell>
                  <p className="max-w-80 truncate">{entry.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.sourceType}
                  </p>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      entry.status === "POSTED" ? "secondary" : "outline"
                    }
                  >
                    {entry.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {entry.totalDebit}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {entry.totalCredit}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pagination
          {...entries.pagination}
          itemLabel="entries"
          searchParams={{ search: params.search, status: params.status }}
        />
      </Card>
    </div>
  );
}
