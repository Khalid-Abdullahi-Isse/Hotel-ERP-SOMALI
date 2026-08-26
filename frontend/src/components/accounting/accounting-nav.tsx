"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  ["Overview", "/accounting"],
  ["Chart of Accounts", "/accounting/chart-of-accounts"],
  ["Journals", "/accounting/journals"],
  ["Entries", "/accounting/journal-entries"],
  ["General Ledger", "/accounting/general-ledger"],
  ["Trial Balance", "/accounting/trial-balance"],
  ["Profit & Loss", "/accounting/profit-loss"],
  ["Balance Sheet", "/accounting/balance-sheet"],
  ["Setup", "/accounting/settings"],
] as const;

export function AccountingNav() {
  const pathname = usePathname();
  return (
    <nav
      className="flex gap-2 overflow-x-auto pb-1"
      aria-label="Accounting sections"
    >
      {links.map(([label, href]) => (
        <Button key={href} asChild variant={pathname === href ? "secondary" : "ghost"} size="sm" className={cn("shrink-0", pathname === href && "font-semibold")}>
          <Link href={href} aria-current={pathname === href ? "page" : undefined}>{label}</Link>
        </Button>
      ))}
    </nav>
  );
}
