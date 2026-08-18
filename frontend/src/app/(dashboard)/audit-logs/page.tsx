import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { AuditLogTable } from "@/components/management/audit-log-table";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAuditLogs } from "@/services/catalog.server";

export const metadata: Metadata = { title: "Audit logs" };
export default async function AuditLogsPage({ searchParams }: { searchParams: Promise<{ page?: string; entityType?: string; action?: string }> }) {
  const params = await searchParams; const parsed = Number(params.page ?? "1"); const page = Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
  const result = await getAuditLogs({ page, entityType: params.entityType, action: params.action });
  const href = (target: number) => { const query = new URLSearchParams(); query.set("page", String(target)); if (params.entityType) query.set("entityType", params.entityType); if (params.action) query.set("action", params.action); return `?${query}`; };
  return <div className="space-y-6"><PageHeader title="Audit logs" description="Review security-sensitive and operational changes across the property." />
    <Card><CardContent><form className="grid items-end gap-4 sm:grid-cols-[1fr_1fr_auto_auto]"><div className="space-y-2"><Label htmlFor="entityType">Record type</Label><Input id="entityType" name="entityType" defaultValue={params.entityType} placeholder="e.g. RoomType" /></div><div className="space-y-2"><Label htmlFor="action">Action</Label><Input id="action" name="action" defaultValue={params.action} placeholder="e.g. room_type.update" /></div><Button type="submit"><Filter />Filter</Button><Button variant="outline" asChild><Link href="/audit-logs">Clear</Link></Button></form></CardContent></Card>
    <AuditLogTable entries={result.data} />
    <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Page {result.pagination.page} of {Math.max(1, result.pagination.pages)} · {result.pagination.total} events</p><div className="flex gap-2"><Button variant="outline" size="sm" asChild className={page <= 1 ? "pointer-events-none opacity-50" : ""}><Link href={href(Math.max(1, page - 1))}><ChevronLeft />Previous</Link></Button><Button variant="outline" size="sm" asChild className={page >= result.pagination.pages ? "pointer-events-none opacity-50" : ""}><Link href={href(Math.min(result.pagination.pages, page + 1))}>Next<ChevronRight /></Link></Button></div></div>
  </div>;
}
