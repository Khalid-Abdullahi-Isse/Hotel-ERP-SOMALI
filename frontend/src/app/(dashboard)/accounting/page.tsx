import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BookOpen, CircleCheck, Landmark, ListChecks, Scale, Settings2, TrendingUp } from "lucide-react";
import { AccountingNav } from "@/components/accounting/accounting-nav";
import { accountingMoney, accountingPeriod } from "@/lib/accounting";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PERMISSIONS } from "@/constants/permissions";
import getBalanceSheet, {
  getAccountingAccounts,
  getAccountingSettings,
  getJournalEntries,
  getProfitLoss,
} from "@/services/accounting.server";
import { getCurrentUser } from "@/services/auth.server";
import { can } from "@/lib/permissions";

export const metadata: Metadata = { title: "Accounting" };

export default async function AccountingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user, PERMISSIONS.accountingRead)) {
    if (can(user, PERMISSIONS.financialReportsRead)) redirect("/accounting/profit-loss");
    if (can(user, PERMISSIONS.chartOfAccountsRead)) redirect("/accounting/chart-of-accounts");
    if (can(user, PERMISSIONS.journalsRead)) redirect("/accounting/journal-entries");
    redirect("/403");
  }
  const period = accountingPeriod();
  const settings = await getAccountingSettings();
  if (!settings) return <div className="space-y-6"><PageHeader title="Accounting" description="Double-entry accounting for hotel operations, controls, and financial statements." actions={<Button asChild><Link href="/accounting/settings"><Settings2 />Open setup</Link></Button>} /><AccountingNav /><Card className="border-dashed"><CardContent className="flex min-h-80 flex-col items-center justify-center px-6 text-center"><div className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary"><BookOpen className="size-6" /></div><h2 className="mt-5 text-xl font-semibold">Accounting is ready to be initialized</h2><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Create the standard chart of accounts and journals, then verify the operational mappings before your first posting.</p><Button className="mt-6" asChild><Link href="/accounting/settings">Set up accounting <ArrowRight /></Link></Button></CardContent></Card></div>;
  const [accounts, profitLoss, balanceSheet, entries] = await Promise.all([
    getAccountingAccounts({ page: 1 }), getProfitLoss(period.dateFrom, period.dateTo), getBalanceSheet(period.dateFrom, period.dateTo), getJournalEntries({ page: 1 }),
  ]);
  const currency = profitLoss.report.currency;
  const metrics = [
    { label: "Revenue", value: profitLoss.totals.revenue, icon: TrendingUp },
    {
      label: "Net profit / loss",
      value: profitLoss.totals.netProfitLoss,
      icon: Scale,
    },
    { label: "Assets", value: balanceSheet.totals.assets, icon: Landmark },
    {
      label: "Ledger accounts",
      value: String(accounts.pagination.total),
      icon: BookOpen,
      count: true,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounting"
        description="Posted double-entry results, controls, and audit-ready financial statements."
        actions={<><Button variant="outline" asChild><Link href="/accounting/settings"><Settings2 />Setup</Link></Button>{can(user, PERMISSIONS.journalsPost) ? <Button asChild><Link href="/accounting/journal-entries/new">New journal entry</Link></Button> : null}</>}
      />
      <AccountingNav />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <CardHeader className="grid grid-cols-[1fr_auto] items-center">
              <CardTitle className="text-sm text-muted-foreground">
                {metric.label}
              </CardTitle>
              <metric.icon className="size-4 text-primary" aria-hidden="true" />
            </CardHeader>
            <CardContent className="text-2xl font-semibold tabular-nums">
              {metric.count
                ? Number(metric.value).toLocaleString()
                : accountingMoney(metric.value, currency)}
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.7fr)]"><Card className="py-0"><div className="flex items-center justify-between border-b px-4 py-4"><div><p className="font-semibold">Recent journal entries</p><p className="text-xs text-muted-foreground">Latest ledger activity across all journals</p></div><Button variant="ghost" size="sm" asChild><Link href="/accounting/journal-entries">View all <ArrowRight /></Link></Button></div>{entries.data.length ? <div className="divide-y">{entries.data.slice(0, 5).map((entry) => <Link href={`/accounting/journal-entries/${entry.id}`} key={entry.id} className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/50"><div className="min-w-0"><div className="flex items-center gap-2"><p className="font-mono text-xs font-semibold text-primary">{entry.entryNumber}</p><Badge variant={entry.status === "POSTED" ? "secondary" : "outline"}>{entry.status}</Badge></div><p className="mt-1 truncate font-medium">{entry.description}</p><p className="text-xs text-muted-foreground">{entry.businessDate.slice(0, 10)} · {entry.journal.code}</p></div><p className="font-mono font-semibold tabular-nums">{accountingMoney(entry.totalDebit, currency)}</p></Link>)}</div> : <div className="px-6 py-14 text-center text-sm text-muted-foreground">No journal entries yet.</div>}</Card>
      <Card><CardHeader><CardTitle>Accounting readiness</CardTitle></CardHeader><CardContent className="space-y-4"><Readiness icon={CircleCheck} title="Ledger initialized" detail={`${accounts.pagination.total} accounts in ${settings.baseCurrency}`} /><Readiness icon={ListChecks} title="Mappings configured" detail="Operational defaults are connected" /><Readiness icon={Scale} title={balanceSheet.totals.balanced ? "Balance sheet balanced" : "Review imbalance"} detail={balanceSheet.totals.balanced ? "Assets equal liabilities plus equity" : `Difference ${balanceSheet.totals.difference}`} /><Button variant="outline" className="w-full" asChild><Link href="/accounting/trial-balance">Run control report</Link></Button></CardContent></Card></div>
    </div>
  );
}

function Readiness({ icon: Icon, title, detail }: { icon: typeof CircleCheck; title: string; detail: string }) { return <div className="flex gap-3"><div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-4" /></div><div><p className="font-medium">{title}</p><p className="text-xs leading-5 text-muted-foreground">{detail}</p></div></div>; }
