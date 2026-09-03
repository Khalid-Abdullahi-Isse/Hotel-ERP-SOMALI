"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle, ChevronDown, TriangleAlert } from "lucide-react";
import type { JournalEntrySummary } from "@/types/accounting";
import { accountingMoney } from "@/lib/accounting";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

function statusBadge(status: JournalEntrySummary["status"]) {
  const variant =
    status === "POSTED" ? "secondary" : status === "REVERSED" ? "destructive" : "outline";
  return (
    <Badge variant={variant} className="text-[10px]">
      {status}
    </Badge>
  );
}

function formatDateTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const datePart = date.toLocaleDateString("en-CA");
  const timePart = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${datePart} ${timePart}`;
}

export function TransactionList({
  entries,
  baseCurrency,
}: {
  entries: JournalEntrySummary[];
  baseCurrency: string;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (entries.length === 0) {
    return (
      <TableBody>
        <TableRow>
          <TableCell
            colSpan={7}
            className="h-32 text-center text-muted-foreground"
          >
            No accounting transactions match the current filters.
          </TableCell>
        </TableRow>
      </TableBody>
    );
  }

  return (
    <TableBody>
      {entries.map((entry) => {
        const isOpen = expanded.has(entry.id);
        const lines = entry.lines ?? [];
        const balanced = Number(entry.difference) === 0;
        return (
          <GroupedRows
            key={entry.id}
            entry={entry}
            lines={lines}
            isOpen={isOpen}
            baseCurrency={baseCurrency}
            onToggle={() => toggle(entry.id)}
            balanced={balanced}
          />
        );
      })}
    </TableBody>
  );
}

function GroupedRows({
  entry,
  lines,
  isOpen,
  baseCurrency,
  onToggle,
  balanced,
}: {
  entry: JournalEntrySummary;
  lines: JournalEntrySummary["lines"];
  isOpen: boolean;
  baseCurrency: string;
  onToggle: () => void;
  balanced: boolean;
}) {
  return (
    <>
      <TableRow className="cursor-pointer hover:bg-muted/50" onClick={onToggle}>
        <TableCell className="p-0">
          <Button
            variant="ghost"
            size="sm"
            className="ml-1 px-1.5"
            onClick={(event) => {
              event.stopPropagation();
              onToggle();
            }}
            aria-expanded={isOpen}
            aria-label={isOpen ? "Collapse transaction" : "Expand transaction"}
          >
            <ChevronDown
              className={cn("size-4 transition-transform", isOpen && "rotate-180")}
            />
          </Button>
        </TableCell>
        <TableCell className="font-mono font-medium text-primary">
          <Link
            href={`/accounting/journal-entries/${entry.id}`}
            className="hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            {entry.entryNumber}
          </Link>
        </TableCell>
        <TableCell>{formatDateTime(entry.postingDate ?? entry.businessDate)}</TableCell>
        <TableCell>{entry.journal.code}</TableCell>
        <TableCell>
          <p className="max-w-80 truncate">{entry.description}</p>
          <p className="text-xs text-muted-foreground">
            {entry.reference ?? entry.sourceType}
          </p>
        </TableCell>
        <TableCell>{statusBadge(entry.status)}</TableCell>
        <TableCell className="text-right font-mono tabular-nums">
          {accountingMoney(entry.totalDebit, baseCurrency)}
        </TableCell>
        <TableCell className="text-right font-mono tabular-nums">
          {accountingMoney(entry.totalCredit, baseCurrency)}
        </TableCell>
      </TableRow>
      {isOpen ? (
        <TableRow className="bg-muted/30">
          <TableCell colSpan={8} className="p-0">
            <TransactionLines
              entry={entry}
              lines={lines}
              baseCurrency={baseCurrency}
              balanced={balanced}
            />
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

function TransactionLines({
  entry,
  lines,
  baseCurrency,
  balanced,
}: {
  entry: JournalEntrySummary;
  lines: JournalEntrySummary["lines"];
  baseCurrency: string;
  balanced: boolean;
}) {
  return (
    <div className="border-y border-border/70 px-4 py-3">
      <div className="mb-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-medium text-foreground">Business date</p>
          {entry.businessDate.slice(0, 10)}
        </div>
        <div>
          <p className="font-medium text-foreground">Status</p>
          {statusBadge(entry.status)}
        </div>
        <div>
          <p className="font-medium text-foreground">Journal</p>
          {entry.journal.code} · {entry.journal.name}
        </div>
        <div>
          <p className="font-medium text-foreground">Posting date</p>
          {formatDateTime(entry.postingDate || entry.businessDate)}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Account</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Credit</TableHead>
              <TableHead className="text-right">Currency</TableHead>
              <TableHead className="text-right">Rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line) => (
              <TableRow key={line.id}>
                <TableCell>
                  <p className="font-mono font-semibold">{line.account.code}</p>
                  <p className="text-xs text-muted-foreground">
                    {line.account.name}
                  </p>
                </TableCell>
                <TableCell>
                  {line.description || entry.description}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {Number(line.debit) !== 0
                    ? accountingMoney(line.debit, baseCurrency)
                    : "—"}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {Number(line.credit) !== 0
                    ? accountingMoney(line.credit, baseCurrency)
                    : "—"}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {line.currency}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {Number(line.exchangeRate)}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/40 font-semibold">
              <TableCell colSpan={2} className="text-right">
                Total
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {accountingMoney(entry.totalDebit, baseCurrency)}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {accountingMoney(entry.totalCredit, baseCurrency)}
              </TableCell>
              <TableCell colSpan={2} className="text-right">
                {balanced ? (
                  <span className="inline-flex items-center gap-1 text-green-600">
                    <CheckCircle className="size-3.5" />
                    Balanced
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-destructive">
                    <TriangleAlert className="size-3.5" />
                    Not balanced (diff {accountingMoney(entry.difference, baseCurrency)})
                  </span>
                )}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
