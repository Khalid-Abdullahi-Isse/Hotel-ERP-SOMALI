import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CalendarDays, FileText, UserRound } from "lucide-react";
import { AccountingNav } from "@/components/accounting/accounting-nav";
import { JournalEntryActions } from "@/components/accounting/journal-entry-actions";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PERMISSIONS } from "@/constants/permissions";
import { can } from "@/lib/permissions";
import { getJournalEntry } from "@/services/accounting.server";
import { getCurrentUser } from "@/services/auth.server";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> { const entry = await getJournalEntry((await params).id); return { title: entry.entryNumber }; }
export default async function JournalEntryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [entry, user] = await Promise.all([getJournalEntry(id), getCurrentUser()]);
  return <div className="space-y-6"><PageHeader title={entry.entryNumber} description="Journal entry detail and permanent posting history." actions={<Button variant="outline" asChild><Link href="/accounting/journal-entries"><ArrowLeft />All entries</Link></Button>} /><AccountingNav />
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]"><div className="space-y-6"><Card><CardHeader className="border-b"><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle>{entry.description}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{entry.journal.code} · {entry.journal.name}</p></div><Badge variant={entry.status === "POSTED" ? "secondary" : entry.status === "REVERSED" ? "destructive" : "outline"}>{entry.status}</Badge></div></CardHeader><CardContent className="grid gap-4 pt-2 sm:grid-cols-3"><Meta icon={CalendarDays} label="Business date" value={entry.businessDate.slice(0, 10)} /><Meta icon={FileText} label="Reference" value={entry.reference || "No reference"} /><Meta icon={UserRound} label="Created by" value={entry.createdBy.fullName} /></CardContent></Card>
      <Card className="py-0"><Table><TableHeader><TableRow><TableHead>Account</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead></TableRow></TableHeader><TableBody>{entry.lines.map((line) => <TableRow key={line.id}><TableCell><p className="font-mono font-semibold">{line.account.code}</p><p className="text-xs text-muted-foreground">{line.account.name}</p></TableCell><TableCell>{line.description || entry.description}</TableCell><TableCell className="text-right font-mono tabular-nums">{line.debit}</TableCell><TableCell className="text-right font-mono tabular-nums">{line.credit}</TableCell></TableRow>)}</TableBody><TableFooter><TableRow><TableCell colSpan={2}>Totals</TableCell><TableCell className="text-right font-mono">{entry.totalDebit}</TableCell><TableCell className="text-right font-mono">{entry.totalCredit}</TableCell></TableRow></TableFooter></Table></Card></div>
      <div className="space-y-6"><Card><CardHeader><CardTitle>Ledger action</CardTitle></CardHeader><CardContent><JournalEntryActions entryId={entry.id} status={entry.status} canPost={Boolean(user && can(user, PERMISSIONS.journalsPost))} canReverse={Boolean(user && can(user, PERMISSIONS.journalsReverse))} /><p className="mt-3 text-xs leading-5 text-muted-foreground">Posted entries are immutable. Corrections are made with a linked reversal.</p></CardContent></Card>
      {entry.reversalReason ? <Card><CardHeader><CardTitle>Reversal history</CardTitle></CardHeader><CardContent className="text-sm"><p>{entry.reversalReason}</p>{entry.reversalEntry ? <Button className="mt-3 px-0" variant="link" asChild><Link href={`/accounting/journal-entries/${entry.reversalEntry.id}`}>View {entry.reversalEntry.entryNumber}</Link></Button> : null}</CardContent></Card> : null}</div></div>
  </div>;
}
function Meta({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) { return <div className="flex gap-3"><div className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted"><Icon className="size-4" /></div><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-0.5 font-medium">{value}</p></div></div>; }
