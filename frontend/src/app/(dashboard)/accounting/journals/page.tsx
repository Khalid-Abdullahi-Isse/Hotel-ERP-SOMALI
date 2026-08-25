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
import { getAccountingJournals } from "@/services/accounting.server";

export const metadata: Metadata = { title: "Accounting Journals" };
export default async function JournalsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string }>;
}) {
  const params = await searchParams;
  const journals = await getAccountingJournals({
    page: parsePage(params.page),
    search: params.search,
  });
  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounting Journals"
        description="Controlled books for sales, cash, bank, adjustments, and night audit."
      />
      <AccountingNav />
      <Card className="py-0">
        <ListToolbar placeholder="Search journal code or name" />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Journal</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Entries</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {journals.data.map((journal) => (
              <TableRow key={journal.id}>
                <TableCell className="font-mono font-medium">
                  {journal.code}
                </TableCell>
                <TableCell className="font-medium">{journal.name}</TableCell>
                <TableCell>{journal.type.replaceAll("_", " ")}</TableCell>
                <TableCell>{journal._count.entries.toLocaleString()}</TableCell>
                <TableCell>
                  <Badge variant={journal.isActive ? "secondary" : "outline"}>
                    {journal.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pagination
          {...journals.pagination}
          itemLabel="journals"
          searchParams={{ search: params.search }}
        />
      </Card>
    </div>
  );
}
