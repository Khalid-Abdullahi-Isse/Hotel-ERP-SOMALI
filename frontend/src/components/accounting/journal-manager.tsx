"use client";

import { useMutation } from "@tanstack/react-query";
import { Check, LoaderCircle, Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getApiError } from "@/lib/api-error";
import { accountingService } from "@/services/accounting.service";
import type { AccountingJournal, AccountingJournalType, JournalInput } from "@/types/accounting";

const types: AccountingJournalType[] = ["GENERAL", "SALES", "CASH", "BANK", "MOBILE_MONEY", "PURCHASE", "ADJUSTMENT", "NIGHT_AUDIT"];

export function JournalManager({ journals, canManage, toolbar, pagination }: { journals: AccountingJournal[]; canManage: boolean; toolbar: React.ReactNode; pagination: React.ReactNode }) {
  const router = useRouter();
  const [editing, setEditing] = useState<AccountingJournal | null | undefined>();
  const mutation = useMutation({ mutationFn: ({ id, input }: { id?: string; input: JournalInput }) => id ? accountingService.updateJournal(id, input) : accountingService.createJournal(input), onSuccess: () => { setEditing(undefined); router.refresh(); } });
  return <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
    <Card className="overflow-hidden py-0"><div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0 flex-1">{toolbar}</div>{canManage ? <Button onClick={() => { setEditing(null); mutation.reset(); }}><Plus />Add journal</Button> : null}</div>
      {journals.length ? <><div className="hidden overflow-x-auto md:block"><Table><TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Journal</TableHead><TableHead>Type</TableHead><TableHead>Entries</TableHead><TableHead>Status</TableHead>{canManage ? <TableHead className="text-right">Action</TableHead> : null}</TableRow></TableHeader><TableBody>{journals.map((journal) => <TableRow key={journal.id}><TableCell className="font-mono font-semibold">{journal.code}</TableCell><TableCell className="font-medium">{journal.name}</TableCell><TableCell>{titleCase(journal.type)}</TableCell><TableCell className="tabular-nums">{journal._count.entries.toLocaleString()}</TableCell><TableCell><Badge variant={journal.isActive ? "secondary" : "outline"}>{journal.isActive ? "Active" : "Inactive"}</Badge></TableCell>{canManage ? <TableCell className="text-right"><Button size="icon-sm" variant="ghost" aria-label={`Edit ${journal.name}`} onClick={() => { setEditing(journal); mutation.reset(); }}><Pencil /></Button></TableCell> : null}</TableRow>)}</TableBody></Table></div><div className="divide-y md:hidden">{journals.map((journal) => <article className="p-4" key={journal.id}><div className="flex justify-between gap-3"><div><p className="font-mono text-xs font-semibold text-primary">{journal.code}</p><p className="mt-1 font-medium">{journal.name}</p><p className="mt-1 text-xs text-muted-foreground">{titleCase(journal.type)} · {journal._count.entries} entries</p></div>{canManage ? <Button size="icon-sm" variant="ghost" aria-label={`Edit ${journal.name}`} onClick={() => { setEditing(journal); mutation.reset(); }}><Pencil /></Button> : null}</div></article>)}</div></> : <div className="px-6 py-16 text-center text-sm text-muted-foreground">No journals found. Initialize accounting or add a journal.</div>}{pagination}</Card>
    {editing !== undefined ? <JournalForm journal={editing} pending={mutation.isPending} error={mutation.error} onCancel={() => setEditing(undefined)} onSubmit={(input) => mutation.mutate({ id: editing?.id, input })} /> : <Card className="border-dashed"><CardContent className="flex min-h-48 flex-col items-center justify-center text-center"><p className="font-medium">Journal controls</p><p className="mt-1 max-w-64 text-sm leading-6 text-muted-foreground">{canManage ? "Create a journal or select one to update its name, type, or availability." : "You have read-only access to accounting journals."}</p></CardContent></Card>}
  </div>;
}

function JournalForm({ journal, pending, error, onCancel, onSubmit }: { journal: AccountingJournal | null; pending: boolean; error: unknown; onCancel: () => void; onSubmit: (input: JournalInput) => void }) {
  const [type, setType] = useState<AccountingJournalType>((journal?.type as AccountingJournalType) ?? "GENERAL");
  return <Card><CardHeader><CardTitle>{journal ? "Edit journal" : "Add journal"}</CardTitle></CardHeader><CardContent><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); onSubmit({ code: String(data.get("code") ?? "").trim().toUpperCase(), name: String(data.get("name") ?? "").trim(), type, isActive: data.get("isActive") === "on" }); }}>
    {error ? <Alert variant="destructive"><AlertTitle>Could not save journal</AlertTitle><AlertDescription>{getApiError(error).message}</AlertDescription></Alert> : null}
    <Field label="Journal code" name="code" required defaultValue={journal?.code ?? ""} pattern="[A-Za-z0-9][A-Za-z0-9_-]*" placeholder="ADJUST" />
    <Field label="Journal name" name="name" required defaultValue={journal?.name ?? ""} placeholder="Adjustment Journal" />
    <div className="space-y-2"><Label htmlFor="journal-type">Journal type</Label><Select value={type} onValueChange={(value: AccountingJournalType) => setType(value)}><SelectTrigger id="journal-type" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{types.map((item) => <SelectItem key={item} value={item}>{titleCase(item)}</SelectItem>)}</SelectContent></Select></div>
    <label className="flex items-center gap-3"><input className="size-4 accent-primary" type="checkbox" name="isActive" defaultChecked={journal?.isActive ?? true} /><span className="font-medium">Active journal</span></label>
    <div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" onClick={onCancel} disabled={pending}>Cancel</Button><Button type="submit" disabled={pending} aria-busy={pending}>{pending ? <LoaderCircle className="animate-spin" /> : <Check />}{pending ? "Saving…" : "Save journal"}</Button></div>
  </form></CardContent></Card>;
}
function Field(props: React.ComponentProps<typeof Input> & { label: string }) { const { label, ...inputProps } = props; return <div className="space-y-2"><Label htmlFor={inputProps.name}>{label}</Label><Input id={inputProps.name} {...inputProps} /></div>; }
function titleCase(value: string) { return value.toLowerCase().replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase()); }
