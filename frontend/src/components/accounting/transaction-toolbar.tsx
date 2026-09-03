"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { ArrowDownWideNarrow, ArrowUpNarrowWide, LoaderCircle, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function submit({ pathname, router, searchParams, patch, deleteKeys, startTransition }: {
  pathname: string;
  router: ReturnType<typeof useRouter>;
  searchParams: URLSearchParams;
  patch: Record<string, string>;
  deleteKeys: string[];
  startTransition: (callback: () => void) => void;
}) {
  const query = new URLSearchParams(searchParams.toString());
  deleteKeys.forEach((key) => query.delete(key));
  Object.entries(patch).forEach(([key, value]) => {
    if (value) query.set(key, value);
    else query.delete(key);
  });
  query.delete("page");
  const suffix = query.toString();
  startTransition(() => router.replace(suffix ? `${pathname}?${suffix}` : pathname));
}

export function TransactionToolbar({
  statuses = [],
  placeholder,
}: {
  statuses?: Array<{ value: string; label: string }>;
  placeholder: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const current = {
    search: searchParams.get("search"),
    status: searchParams.get("status"),
    dateFrom: searchParams.get("dateFrom"),
    dateTo: searchParams.get("dateTo"),
    accountCode: searchParams.get("accountCode"),
    currency: searchParams.get("currency"),
    order: searchParams.get("order") ?? "asc",
  };

  function apply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    submit({
      pathname,
      router,
      searchParams,
      patch: {
        search: String(data.get("search") ?? ""),
        status: String(data.get("status") ?? ""),
        dateFrom: String(data.get("dateFrom") ?? ""),
        dateTo: String(data.get("dateTo") ?? ""),
        accountCode: String(data.get("accountCode") ?? ""),
        currency: String(data.get("currency") ?? ""),
        order: String(data.get("order") ?? "asc"),
      },
      deleteKeys: [],
      startTransition,
    });
  }

  function clear() {
    submit({
      pathname,
      router,
      searchParams,
      patch: { search: "", status: "", dateFrom: "", dateTo: "", accountCode: "", currency: "", order: "asc" },
      deleteKeys: [],
      startTransition,
    });
  }

  function toggleSort() {
    const next = current.order === "asc" ? "desc" : "asc";
    submit({
      pathname,
      router,
      searchParams,
      patch: { order: next },
      deleteKeys: [],
      startTransition,
    });
  }

  const hasFilters = Boolean(
    current.search || (current.status && current.status !== "all") || current.dateFrom || current.dateTo || current.accountCode || current.currency,
  );

  return (
    <form
      onSubmit={apply}
      className="flex flex-col gap-3 border-b border-outline-variant bg-surface-container-low/55 p-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xl">
          {isPending ? (
            <LoaderCircle className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-primary" aria-hidden="true" />
          ) : (
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          )}
          <Input
            name="search"
            defaultValue={current.search ?? ""}
            type="search"
            placeholder={placeholder}
            aria-label={placeholder}
            className="pl-10"
            maxLength={160}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select name="status" defaultValue={current.status ?? "all"}>
            <SelectTrigger className="w-full sm:w-40" aria-label="Filter by status">
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
          <Select name="order" defaultValue={current.order ?? "asc"}>
            <SelectTrigger className="w-full sm:w-40" aria-label="Sort order">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">Oldest first</SelectItem>
              <SelectItem value="desc">Newest first</SelectItem>
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" size="icon" onClick={toggleSort} aria-label="Toggle sort order" title={`Currently ${current.order === "asc" ? "oldest" : "newest"} first`}>
            {current.order === "asc" ? <ArrowUpNarrowWide className="size-4" /> : <ArrowDownWideNarrow className="size-4" />}
          </Button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          From
          <Input name="dateFrom" type="date" defaultValue={current.dateFrom ?? ""} />
        </label>
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          To
          <Input name="dateTo" type="date" defaultValue={current.dateTo ?? ""} />
        </label>
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Account code
          <Input name="accountCode" defaultValue={current.accountCode ?? ""} placeholder="e.g. 1110" maxLength={32} />
        </label>
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Currency
          <Input name="currency" defaultValue={current.currency ?? ""} placeholder="e.g. USD" maxLength={3} />
        </label>
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" variant="outline">
          Apply filters
        </Button>
        {hasFilters ? (
          <Button type="button" variant="ghost" size="sm" onClick={clear}>
            <X />
            Clear
          </Button>
        ) : null}
      </div>
    </form>
  );
}
