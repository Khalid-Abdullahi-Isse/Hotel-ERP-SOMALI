import Link from "next/link";
import { Button } from "@/components/ui/button";

const links = [
  ["Overview", "/accounting"],
  ["Chart of Accounts", "/accounting/chart-of-accounts"],
  ["Journals", "/accounting/journals"],
  ["Entries", "/accounting/journal-entries"],
  ["General Ledger", "/accounting/general-ledger"],
  ["Trial Balance", "/accounting/trial-balance"],
  ["Profit & Loss", "/accounting/profit-loss"],
  ["Balance Sheet", "/accounting/balance-sheet"],
] as const;

export function AccountingNav() {
  return (
    <nav
      className="flex gap-2 overflow-x-auto pb-1"
      aria-label="Accounting sections"
    >
      {links.map(([label, href]) => (
        <Button key={href} asChild variant="outline" size="sm">
          <Link href={href}>{label}</Link>
        </Button>
      ))}
    </nav>
  );
}

export function accountingPeriod() {
  const now = new Date();
  const dateTo = now.toISOString().slice(0, 10);
  const dateFrom = `${dateTo.slice(0, 8)}01`;
  return { dateFrom, dateTo };
}

export function accountingMoney(value: string, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
}
