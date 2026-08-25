import type { Metadata } from "next";
import Link from "next/link";
import { Filter } from "lucide-react";
import { AuditLogTable } from "@/components/management/audit-log-table";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAuditLogs } from "@/services/catalog.server";
import { Pagination } from "@/components/shared/pagination";
import { parsePage } from "@/lib/pagination";
import { redirectOutOfRangePage } from "@/lib/pagination.server";

export const metadata: Metadata = { title: "Audit logs" };
export default async function AuditLogsPage({ searchParams }: { searchParams: Promise<{ page?: string; entityType?: string; action?: string }> }) {
  const params = await searchParams; const page = parsePage(params.page);
  const result = await getAuditLogs({ page, entityType: params.entityType, action: params.action });
  redirectOutOfRangePage(page, result.pagination.totalPages, "/audit-logs", params);
  return <div className="space-y-6"><PageHeader title="Audit logs" description="Review security-sensitive and operational changes across the property." />
    <Card><CardContent><form className="grid items-end gap-4 sm:grid-cols-[1fr_1fr_auto_auto]"><div className="space-y-2"><Label htmlFor="entityType">Record type</Label><Input id="entityType" name="entityType" defaultValue={params.entityType} placeholder="e.g. RoomType" /></div><div className="space-y-2"><Label htmlFor="action">Action</Label><Input id="action" name="action" defaultValue={params.action} placeholder="e.g. room_type.update" /></div><Button type="submit"><Filter />Filter</Button><Button variant="outline" asChild><Link href="/audit-logs">Clear</Link></Button></form></CardContent></Card>
    <AuditLogTable entries={result.data} />
    <Pagination {...result.pagination} itemLabel="events" searchParams={{ entityType: params.entityType, action: params.action }} />
  </div>;
}
