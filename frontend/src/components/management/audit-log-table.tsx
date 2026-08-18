import { ScrollText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ApiAuditLog } from "@/types/api-contracts";

export function AuditLogTable({ entries }: { entries: ApiAuditLog[] }) {
  return <Card className="overflow-hidden py-0">
    {entries.length === 0 ? <div className="flex flex-col items-center px-6 py-14 text-center"><ScrollText className="mb-3 size-8 text-muted-foreground" /><p className="font-medium">No audit events found</p><p className="text-sm text-muted-foreground">Try clearing the filters.</p></div> : <div className="overflow-x-auto"><Table>
      <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Action</TableHead><TableHead>Record</TableHead><TableHead>User</TableHead><TableHead>Identifier</TableHead></TableRow></TableHeader>
      <TableBody>{entries.map((entry) => <TableRow key={entry.id}>
        <TableCell className="whitespace-nowrap text-muted-foreground">{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.createdAt))}</TableCell>
        <TableCell><Badge variant="outline">{entry.action.replaceAll("_", " ")}</Badge></TableCell><TableCell className="font-medium">{entry.entityType}</TableCell><TableCell>{entry.user?.fullName ?? "System"}</TableCell><TableCell className="max-w-48 truncate font-mono text-xs text-muted-foreground" title={entry.entityId}>{entry.entityId}</TableCell>
      </TableRow>)}</TableBody>
    </Table></div>}
  </Card>;
}
