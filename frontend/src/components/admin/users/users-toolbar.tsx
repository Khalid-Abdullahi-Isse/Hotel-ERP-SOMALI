"use client";

import { LoaderCircle, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function UsersToolbar() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const currentSearch = params.get("search") ?? "";
  const statusParam = params.get("status");
  const currentStatus = statusParam === "active" || statusParam === "inactive" || statusParam === "locked" ? statusParam : "all";
  const [draft, setDraft] = useState({ source: currentSearch, value: currentSearch });
  const [pending, startTransition] = useTransition();
  const search = draft.source === currentSearch ? draft.value : currentSearch;

  function navigate(update: (query: URLSearchParams) => void) {
    const query = new URLSearchParams(params.toString());
    update(query);
    query.delete("page");
    startTransition(() => router.replace(query.size ? `${pathname}?${query}` : pathname));
  }

  useEffect(() => {
    if (search === currentSearch) return;
    const timer = window.setTimeout(() => navigate((query) => search.trim() ? query.set("search", search.trim()) : query.delete("search")), 400);
    return () => window.clearTimeout(timer);
  // navigate intentionally reads the current URL snapshot for this render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, currentSearch]);

  return <div className="flex flex-col gap-3 border-b bg-surface-container-low/55 p-4 md:flex-row md:items-center">
    <div className="relative flex-1 md:max-w-xl">
      {pending ? <LoaderCircle className="absolute left-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-primary" aria-hidden="true" /> : <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />}
      <Input type="search" value={search} onChange={(event) => setDraft({ source: currentSearch, value: event.target.value })} placeholder="Search users..." aria-label="Search users" aria-busy={pending} maxLength={160} className="pl-10" />
    </div>
    <Select value={currentStatus} onValueChange={(value) => navigate((query) => value === "all" ? query.delete("status") : query.set("status", value))}>
      <SelectTrigger className="w-full md:w-48" aria-label="Filter users by account status"><SelectValue /></SelectTrigger>
      <SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="locked">Locked</SelectItem></SelectContent>
    </Select>
    {currentSearch || currentStatus !== "all" ? <Button variant="ghost" size="sm" onClick={() => { setDraft({ source: "", value: "" }); navigate((query) => { query.delete("search"); query.delete("status"); }); }}><X />Clear filters</Button> : null}
  </div>;
}
