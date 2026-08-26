"use client";

import { useMutation } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, LoaderCircle, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getApiError } from "@/lib/api-error";
import { accountingService } from "@/services/accounting.service";
import type { AccountingAccount, AccountingJournal } from "@/types/accounting";

type Line = { key: string; accountId: string; description: string; debit: string; credit: string };
const newLine = (): Line => ({ key: crypto.randomUUID(), accountId: "", description: "", debit: "", credit: "" });

export function JournalEntryForm({ journals, accounts, businessDate }: { journals: AccountingJournal[]; accounts: AccountingAccount[]; businessDate: string }) {
  const router = useRouter();
  const [journalId, setJournalId] = useState("");
  const [lines, setLines] = useState<Line[]>(() => [newLine(), newLine()]);
  const [validation, setValidation] = useState<string | null>(null);
  const totals = useMemo(() => lines.reduce((value, line) => ({ debit: value.debit + amount(line.debit), credit: value.credit + amount(line.credit) }), { debit: 0, credit: 0 }), [lines]);
  const difference = totals.debit - totals.credit;
  const mutation = useMutation({ mutationFn: accountingService.createEntry, onSuccess: (entry) => router.push(`/accounting/journal-entries/${entry.id}`) });
  const updateLine = (key: string, values: Partial<Line>) => setLines((current) => current.map((line) => line.key === key ? { ...line, ...values } : line));
  return <form className="space-y-6" onSubmit={(event) => { event.preventDefault(); setValidation(null); const data = new FormData(event.currentTarget); if (!journalId) return setValidation("Choose a journal."); if (lines.some((line) => !line.accountId || (amount(line.debit) > 0) === (amount(line.credit) > 0))) return setValidation("Each line needs an account and an amount on exactly one side."); if (totals.debit <= 0 || Math.abs(difference) > 0.0001) return setValidation("Total debits and credits must be equal and greater than zero."); mutation.mutate({ journalId, businessDate: String(data.get("businessDate")), reference: String(data.get("reference") ?? "").trim() || undefined, description: String(data.get("description") ?? "").trim(), lines: lines.map((line) => ({ accountId: line.accountId, description: line.description.trim() || undefined, debit: money(line.debit), credit: money(line.credit) })) }); }}>
    <Card><CardHeader><CardTitle>Entry header</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label htmlFor="entry-journal">Journal</Label><Select value={journalId} onValueChange={setJournalId}><SelectTrigger id="entry-journal" className="w-full"><SelectValue placeholder="Select an active journal" /></SelectTrigger><SelectContent>{journals.map((journal) => <SelectItem key={journal.id} value={journal.id}>{journal.code} · {journal.name}</SelectItem>)}</SelectContent></Select></div><Field label="Business date" name="businessDate" type="date" required defaultValue={businessDate} /><Field label="Reference (optional)" name="reference" placeholder="Invoice, correction, or batch reference" /><div className="space-y-2 md:col-span-2"><Label htmlFor="entry-description">Description</Label><Textarea id="entry-description" name="description" required maxLength={255} rows={3} placeholder="Explain the business purpose of this entry" /></div></CardContent></Card>
    <Card className="py-0"><div className="flex items-center justify-between border-b px-4 py-4"><div><p className="font-semibold">Debit and credit lines</p><p className="text-xs text-muted-foreground">Use posting accounts only. A line cannot contain both a debit and a credit.</p></div><Button type="button" variant="outline" size="sm" onClick={() => setLines((current) => [...current, newLine()])}><Plus />Add line</Button></div><div className="divide-y">{lines.map((line, index) => <div className="grid gap-3 p-4 lg:grid-cols-[minmax(220px,1.4fr)_minmax(180px,1fr)_140px_140px_36px]" key={line.key}><div className="space-y-2"><Label htmlFor={`account-${line.key}`}>Account {index + 1}</Label><Select value={line.accountId} onValueChange={(value) => updateLine(line.key, { accountId: value })}><SelectTrigger id={`account-${line.key}`} className="w-full"><SelectValue placeholder="Select account" /></SelectTrigger><SelectContent>{accounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.code} · {account.name}</SelectItem>)}</SelectContent></Select></div><Field label="Line description" value={line.description} onChange={(event) => updateLine(line.key, { description: event.target.value })} /><Field label="Debit" inputMode="decimal" pattern="\d{0,15}(\.\d{0,4})?" value={line.debit} onChange={(event) => updateLine(line.key, { debit: event.target.value, ...(amount(event.target.value) > 0 ? { credit: "" } : {}) })} placeholder="0.00" /><Field label="Credit" inputMode="decimal" pattern="\d{0,15}(\.\d{0,4})?" value={line.credit} onChange={(event) => updateLine(line.key, { credit: event.target.value, ...(amount(event.target.value) > 0 ? { debit: "" } : {}) })} placeholder="0.00" /><div className="flex items-end"><Button type="button" variant="ghost" size="icon" disabled={lines.length <= 2} onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))} aria-label={`Remove line ${index + 1}`}><Trash2 /></Button></div></div>)}</div><div className="grid gap-2 border-t bg-muted/30 px-4 py-4 text-sm sm:grid-cols-3"><div><span className="text-muted-foreground">Total debit</span><p className="font-mono text-lg font-semibold tabular-nums">{totals.debit.toFixed(2)}</p></div><div><span className="text-muted-foreground">Total credit</span><p className="font-mono text-lg font-semibold tabular-nums">{totals.credit.toFixed(2)}</p></div><div><span className="text-muted-foreground">Difference</span><p className={`font-mono text-lg font-semibold tabular-nums ${Math.abs(difference) > 0.0001 ? "text-destructive" : "text-primary"}`}>{Math.abs(difference).toFixed(2)}</p></div></div></Card>
    {validation ? <Alert variant="destructive"><AlertCircle /><AlertTitle>Entry is not ready</AlertTitle><AlertDescription>{validation}</AlertDescription></Alert> : null}
    {mutation.error ? <Alert variant="destructive"><AlertTitle>Could not create draft</AlertTitle><AlertDescription>{getApiError(mutation.error).message}</AlertDescription></Alert> : null}
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="outline" asChild><Link href="/accounting/journal-entries"><ArrowLeft />Cancel</Link></Button><Button type="submit" disabled={mutation.isPending} aria-busy={mutation.isPending}>{mutation.isPending ? <LoaderCircle className="animate-spin" /> : null}{mutation.isPending ? "Creating draft…" : "Create draft entry"}</Button></div>
  </form>;
}
function Field(props: React.ComponentProps<typeof Input> & { label: string }) { const { label, ...inputProps } = props; return <div className="space-y-2"><Label htmlFor={inputProps.name}>{label}</Label><Input id={inputProps.name} {...inputProps} /></div>; }
function amount(value: string) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function money(value: string) { return amount(value).toFixed(4); }
