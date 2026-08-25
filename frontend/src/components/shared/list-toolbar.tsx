"use client";

import { LoaderCircle, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ListToolbar({
  placeholder,
  statuses = [],
}: {
  placeholder: string;
  statuses?: Array<{ value: string; label: string }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSearch = searchParams.get("search") ?? "";
  const currentStatus = searchParams.get("status") ?? "all";
  const [searchState, setSearchState] = useState({ urlValue: currentSearch, value: currentSearch });
  const [isPending, startTransition] = useTransition();
  const search = searchState.urlValue === currentSearch ? searchState.value : currentSearch;

  useEffect(() => {
    if (search === currentSearch) return;
    const timer = window.setTimeout(() => {
      const query = new URLSearchParams(searchParams.toString());
      if (search.trim()) query.set("search", search.trim());
      else query.delete("search");
      query.delete("page");
      startTransition(() => router.replace(`${pathname}?${query.toString()}`));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [currentSearch, pathname, router, search, searchParams]);

  function setStatus(value: string) {
    const query = new URLSearchParams(searchParams.toString());
    if (value === "all") query.delete("status");
    else query.set("status", value);
    query.delete("page");
    startTransition(() => router.replace(`${pathname}?${query.toString()}`));
  }

  return (
    <div className="flex flex-col gap-3 border-b border-outline-variant bg-surface-container-low/55 p-4 sm:flex-row sm:items-center">
      <div className="relative flex-1 sm:max-w-xl">
        {isPending ? <LoaderCircle
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-primary"
          aria-hidden="true"
        /> : <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />}
        <Input
          value={search}
          onChange={(event) => setSearchState({ urlValue: currentSearch, value: event.target.value })}
          type="search"
          placeholder={placeholder}
          aria-label={placeholder}
          aria-busy={isPending}
          className="pl-10"
          maxLength={160}
        />
      </div>
      {statuses.length ? (
        <Select value={currentStatus} onValueChange={setStatus}>
          <SelectTrigger
            className="w-full sm:w-48"
            aria-label="Filter by status"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {statuses.map((status) => (
              <SelectItem key={status.value} value={status.value}>
                {status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      {currentSearch || currentStatus !== "all" ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSearchState({ urlValue: "", value: "" });
            const query = new URLSearchParams(searchParams.toString());
            query.delete("search");
            query.delete("status");
            query.delete("page");
            const suffix = query.toString();
            startTransition(() => router.replace(suffix ? `${pathname}?${suffix}` : pathname));
          }}
        >
          <X />
          Clear
        </Button>
      ) : null}
    </div>
  );
}
