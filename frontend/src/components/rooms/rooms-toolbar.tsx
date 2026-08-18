"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { RoomStatus } from "@/types/room";

const statuses: Array<{ value: RoomStatus; label: string }> = [
  { value: "available", label: "Available" }, { value: "occupied", label: "Occupied" },
  { value: "reserved", label: "Reserved" }, { value: "cleaning", label: "Cleaning" },
  { value: "dirty", label: "Dirty" },
  { value: "maintenance", label: "Maintenance" },
];

export function RoomsToolbar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSearch = searchParams.get("search") ?? "";
  const currentStatus = searchParams.get("status") ?? "all";
  const [search, setSearch] = useState(currentSearch);

  useEffect(() => {
    if (search === currentSearch) return;
    const timer = window.setTimeout(() => {
      const query = new URLSearchParams(searchParams.toString());
      if (search.trim()) query.set("search", search.trim()); else query.delete("search");
      query.delete("page");
      router.replace(`${pathname}?${query.toString()}`);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [currentSearch, pathname, router, search, searchParams]);

  function setStatus(value: string) {
    const query = new URLSearchParams(searchParams.toString());
    if (value === "all") query.delete("status"); else query.set("status", value);
    query.delete("page");
    router.replace(`${pathname}?${query.toString()}`);
  }

  const hasFilters = Boolean(currentSearch || currentStatus !== "all");
  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div className="relative flex-1 sm:max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search room number..." className="pl-9" aria-label="Search rooms" maxLength={32} />
      </div>
      <Select value={currentStatus} onValueChange={setStatus}>
        <SelectTrigger className="w-full sm:w-44" aria-label="Filter by status"><SelectValue placeholder="All statuses" /></SelectTrigger>
        <SelectContent><SelectItem value="all">All statuses</SelectItem>{statuses.map((status) => <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>)}</SelectContent>
      </Select>
      {hasFilters ? <Button variant="ghost" size="sm" onClick={() => { setSearch(""); router.replace(pathname); }}><X />Clear</Button> : null}
    </div>
  );
}
