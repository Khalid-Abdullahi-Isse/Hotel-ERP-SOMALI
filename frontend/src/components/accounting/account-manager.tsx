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
import type { AccountingAccount, AccountInput, AccountType } from "@/types/accounting";

const accountTypes: AccountType[] = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"];

export function AccountManager({ accounts, allAccounts, canManage, toolbar, pagination }: {
  accounts: AccountingAccount[];
  allAccounts: AccountingAccount[];
  canManage: boolean;
  toolbar: React.ReactNode;
  pagination: React.ReactNode;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<AccountingAccount | null | undefined>();
  const mutation = useMutation({
    mutationFn: ({ id, input }: { id?: string; input: AccountInput }) => id ? accountingService.updateAccount(id, input) : accountingService.createAccount(input),
    onSuccess: () => { setEditing(undefined); router.refresh(); },
  });
  return <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
    <Card className="overflow-hidden py-0">
      <div className="flex flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">{toolbar}</div>
        {canManage ? <Button onClick={() => { setEditing(null); mutation.reset(); }}><Plus />Add account</Button> : null}
      </div>
      {accounts.length ? <AccountTable accounts={accounts} canManage={canManage} onEdit={(item) => { setEditing(item); mutation.reset(); }} /> : <div className="px-6 py-16 text-center"><p className="font-medium">No accounts found</p><p className="mt-1 text-sm text-muted-foreground">Try another search or initialize accounting setup.</p></div>}
      {pagination}
    </Card>
    {editing !== undefined ? <AccountForm account={editing} accounts={allAccounts} pending={mutation.isPending} error={mutation.error} onCancel={() => setEditing(undefined)} onSubmit={(input) => mutation.mutate({ id: editing?.id, input })} /> : <Card className="border-dashed"><CardContent className="flex min-h-48 flex-col items-center justify-center text-center"><p className="font-medium">Account controls</p><p className="mt-1 max-w-64 text-sm leading-6 text-muted-foreground">{canManage ? "Add a posting or header account, or select a row to update its controls." : "You have read-only access to the hotel chart of accounts."}</p></CardContent></Card>}
  </div>;
}

function AccountTable({ accounts, canManage, onEdit }: { accounts: AccountingAccount[]; canManage: boolean; onEdit: (account: AccountingAccount) => void }) {
  return <><div className="hidden overflow-x-auto md:block"><Table><TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Account</TableHead><TableHead>Type</TableHead><TableHead>Posting</TableHead><TableHead>Status</TableHead>{canManage ? <TableHead className="text-right">Action</TableHead> : null}</TableRow></TableHeader><TableBody>{accounts.map((account) => <TableRow key={account.id}><TableCell className="font-mono font-semibold">{account.code}</TableCell><TableCell><p className="font-medium">{account.name}</p><p className="text-xs text-muted-foreground">{account.parent ? `Under ${account.parent.code} · ${account.parent.name}` : "Top-level account"}</p></TableCell><TableCell>{titleCase(account.type)}</TableCell><TableCell><Badge variant="outline">{account.allowManualPosting ? "Manual allowed" : "Automated / header"}</Badge></TableCell><TableCell><Badge variant={account.isActive ? "secondary" : "outline"}>{account.isActive ? "Active" : "Inactive"}</Badge></TableCell>{canManage ? <TableCell className="text-right"><Button size="icon-sm" variant="ghost" aria-label={`Edit ${account.name}`} onClick={() => onEdit(account)}><Pencil /></Button></TableCell> : null}</TableRow>)}</TableBody></Table></div>
  <div className="divide-y md:hidden">{accounts.map((account) => <article key={account.id} className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-xs font-semibold text-primary">{account.code}</p><p className="mt-1 font-medium">{account.name}</p></div>{canManage ? <Button size="icon-sm" variant="ghost" aria-label={`Edit ${account.name}`} onClick={() => onEdit(account)}><Pencil /></Button> : null}</div><div className="mt-3 flex flex-wrap gap-2"><Badge variant="outline">{titleCase(account.type)}</Badge><Badge variant={account.isActive ? "secondary" : "outline"}>{account.isActive ? "Active" : "Inactive"}</Badge></div></article>)}</div></>;
}

function AccountForm({ account, accounts, pending, error, onCancel, onSubmit }: { account: AccountingAccount | null; accounts: AccountingAccount[]; pending: boolean; error: unknown; onCancel: () => void; onSubmit: (input: AccountInput) => void }) {
  const [type, setType] = useState<AccountType>(account?.type ?? "ASSET");
  const [normalBalance, setNormalBalance] = useState<"DEBIT" | "CREDIT">(account?.normalBalance ?? "DEBIT");
  const [parent, setParent] = useState(account?.parent?.id ?? "none");
  return <Card><CardHeader><CardTitle>{account ? "Edit account" : "Add account"}</CardTitle></CardHeader><CardContent><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); onSubmit({ code: text(data, "code").toUpperCase(), name: text(data, "name"), type, subType: text(data, "subType") || undefined, normalBalance, parentAccountId: parent === "none" ? undefined : parent, isActive: data.get("isActive") === "on", allowManualPosting: data.get("allowManualPosting") === "on" }); }}>
    {error ? <Alert variant="destructive"><AlertTitle>Could not save account</AlertTitle><AlertDescription>{getApiError(error).message}</AlertDescription></Alert> : null}
    <div className="grid grid-cols-2 gap-3"><Field label="Account code" name="code" required defaultValue={account?.code ?? ""} pattern="[A-Za-z0-9][A-Za-z0-9._-]*" /><Field label="Account name" name="name" required defaultValue={account?.name ?? ""} /></div>
    <div className="space-y-2"><Label htmlFor="account-type">Account type</Label><Select value={type} onValueChange={(value: AccountType) => { setType(value); setParent("none"); setNormalBalance(value === "ASSET" || value === "EXPENSE" ? "DEBIT" : "CREDIT"); }}><SelectTrigger id="account-type" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{accountTypes.map((item) => <SelectItem key={item} value={item}>{titleCase(item)}</SelectItem>)}</SelectContent></Select></div>
    <div className="space-y-2"><Label htmlFor="normal-balance">Normal balance</Label><Select value={normalBalance} onValueChange={(value: "DEBIT" | "CREDIT") => setNormalBalance(value)}><SelectTrigger id="normal-balance" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="DEBIT">Debit</SelectItem><SelectItem value="CREDIT">Credit</SelectItem></SelectContent></Select></div>
    <div className="space-y-2"><Label htmlFor="parent-account">Parent account</Label><Select value={parent} onValueChange={setParent}><SelectTrigger id="parent-account" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No parent (top level)</SelectItem>{accounts.filter((item) => item.type === type && item.id !== account?.id).map((item) => <SelectItem key={item.id} value={item.id}>{item.code} · {item.name}</SelectItem>)}</SelectContent></Select></div>
    <Field label="Subtype (optional)" name="subType" defaultValue={account?.subType ?? ""} placeholder="e.g. Current asset" />
    <label className="flex items-start gap-3 rounded-xl border p-3"><input className="mt-1 size-4 accent-primary" type="checkbox" name="allowManualPosting" defaultChecked={account?.allowManualPosting ?? true} /><span><span className="block font-medium">Allow manual posting</span><span className="text-xs leading-5 text-muted-foreground">Disable for headers and system-controlled accounts.</span></span></label>
    <label className="flex items-center gap-3"><input className="size-4 accent-primary" type="checkbox" name="isActive" defaultChecked={account?.isActive ?? true} /><span className="font-medium">Active account</span></label>
    <div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" onClick={onCancel} disabled={pending}>Cancel</Button><Button type="submit" disabled={pending} aria-busy={pending}>{pending ? <LoaderCircle className="animate-spin" /> : <Check />}{pending ? "Saving…" : "Save account"}</Button></div>
  </form></CardContent></Card>;
}

function Field(props: React.ComponentProps<typeof Input> & { label: string }) { const { label, ...inputProps } = props; return <div className="space-y-2"><Label htmlFor={inputProps.name}>{label}</Label><Input id={inputProps.name} {...inputProps} /></div>; }
function text(data: FormData, key: string) { return String(data.get(key) ?? "").trim(); }
function titleCase(value: string) { return value.toLowerCase().replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase()); }
