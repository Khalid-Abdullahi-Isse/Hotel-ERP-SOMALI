"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/components/providers/auth-provider";
import { PERMISSIONS, type Permission } from "@/constants/permissions";
import { cn } from "@/lib/utils";

const links = [
  ["Overview", "/accounting", PERMISSIONS.accountingRead],
  ["Chart of Accounts", "/accounting/chart-of-accounts", PERMISSIONS.chartOfAccountsRead],
  ["Journals", "/accounting/journals", PERMISSIONS.journalsRead],
  ["Transactions", "/accounting/journal-entries", PERMISSIONS.journalsRead],
  ["General Ledger", "/accounting/general-ledger", PERMISSIONS.financialReportsRead],
  ["Trial Balance", "/accounting/trial-balance", PERMISSIONS.financialReportsRead],
  ["Profit & Loss", "/accounting/profit-loss", PERMISSIONS.financialReportsRead],
  ["Balance Sheet", "/accounting/balance-sheet", PERMISSIONS.financialReportsRead],
  ["Setup", "/accounting/settings", PERMISSIONS.accountingRead],
] satisfies ReadonlyArray<readonly [string, string, Permission]>;

export function AccountingNav() {
  const pathname = usePathname();
  const { has } = usePermissions();
  return (
    <nav
      className="flex gap-2 overflow-x-auto pb-1"
      aria-label="Accounting sections"
    >
      {links.filter(([, , permission]) => has(permission)).map(([label, href]) => (
        <Button key={href} asChild variant={pathname === href ? "secondary" : "ghost"} size="sm" className={cn("shrink-0", pathname === href && "font-semibold")}>
          <Link href={href} aria-current={pathname === href ? "page" : undefined}>{label}</Link>
        </Button>
      ))}
    </nav>
  );
}
