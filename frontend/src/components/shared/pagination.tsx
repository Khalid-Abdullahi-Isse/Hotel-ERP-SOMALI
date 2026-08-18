import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

function hrefFor(page: number, searchParams: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  Object.entries(searchParams).forEach(([key, value]) => { if (value) query.set(key, value); });
  query.set("page", String(page));
  return `?${query.toString()}`;
}

export function Pagination({ page, totalPages, total, searchParams }: { page: number; totalPages: number; total: number; searchParams: Record<string, string | undefined> }) {
  if (totalPages <= 1) return <p className="text-sm text-muted-foreground">{total} {total === 1 ? "room" : "rooms"}</p>;
  return (
    <div className="flex flex-col gap-3 border-t px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">Page {page} of {totalPages} · {total} rooms</p>
      <div className="flex gap-2">
        <Button asChild variant="outline" size="sm" className={page <= 1 ? "pointer-events-none opacity-50" : ""}><Link href={hrefFor(Math.max(1, page - 1), searchParams)} aria-disabled={page <= 1}><ChevronLeft />Previous</Link></Button>
        <Button asChild variant="outline" size="sm" className={page >= totalPages ? "pointer-events-none opacity-50" : ""}><Link href={hrefFor(Math.min(totalPages, page + 1), searchParams)} aria-disabled={page >= totalPages}>Next<ChevronRight /></Link></Button>
      </div>
    </div>
  );
}
