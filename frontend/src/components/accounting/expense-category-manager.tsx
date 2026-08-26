"use client";

import { useMutation } from "@tanstack/react-query";
import { Check, LoaderCircle, Pencil, Plus, RotateCcw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getApiError } from "@/lib/api-error";
import { expenseCategoryService } from "@/services/expense-categories.service";
import type { AccountingAccount } from "@/types/accounting";
import type { ApiExpenseCategory } from "@/types/api-contracts";

export function ExpenseCategoryManager({ categories, accounts, canManage }: { categories: ApiExpenseCategory[]; accounts: AccountingAccount[]; canManage: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<ApiExpenseCategory | null | undefined>();
  const mutation = useMutation({ mutationFn: (operation: () => Promise<unknown>) => operation(), onSuccess: () => { setEditing(undefined); router.refresh(); } });
  return <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]"><Card className="py-0"><div className="flex items-center justify-between border-b p-4"><div><p className="font-semibold">Expense categories</p><p className="text-xs text-muted-foreground">{categories.length} configured</p></div>{canManage ? <Button onClick={() => { setEditing(null); mutation.reset(); }}><Plus />Add category</Button> : null}</div>{categories.length ? <div className="divide-y">{categories.map((category) => { const account = accounts.find((item) => item.id === category.expenseAccountId); return <article key={category.id} className="flex items-center justify-between gap-4 p-4"><div><div className="flex items-center gap-2"><p className="font-medium">{category.name}</p><Badge variant={category.isActive ? "secondary" : "outline"}>{category.isActive ? "Active" : "Inactive"}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{account ? `${account.code} · ${account.name}` : "Uses the fallback expense account"}</p></div>{canManage ? <div className="flex gap-1"><Button variant="ghost" size="icon-sm" aria-label={`Edit ${category.name}`} onClick={() => { setEditing(category); mutation.reset(); }}><Pencil /></Button><Button variant="ghost" size="icon-sm" aria-label={category.isActive ? `Deactivate ${category.name}` : `Restore ${category.name}`} onClick={() => mutation.mutate(() => expenseCategoryService.setActive(category.id, !category.isActive))}>{category.isActive ? <X /> : <RotateCcw />}</Button></div> : null}</article>; })}</div> : <div className="px-6 py-16 text-center text-sm text-muted-foreground">No expense categories configured.</div>}</Card>
  {editing !== undefined ? <CategoryForm key={editing?.id ?? "new"} category={editing} accounts={accounts} pending={mutation.isPending} error={mutation.error} onCancel={() => setEditing(undefined)} onSubmit={(input) => mutation.mutate(() => editing ? expenseCategoryService.update(editing.id, input) : expenseCategoryService.create(input))} /> : <Card className="border-dashed"><CardContent className="flex min-h-48 flex-col items-center justify-center text-center"><p className="font-medium">Expense posting</p><p className="mt-1 max-w-64 text-sm leading-6 text-muted-foreground">Map each category to the expense account that should be debited automatically.</p></CardContent></Card>}</div>;
}
function CategoryForm({ category, accounts, pending, error, onCancel, onSubmit }: { category: ApiExpenseCategory | null; accounts: AccountingAccount[]; pending: boolean; error: unknown; onCancel: () => void; onSubmit: (input: { name: string; expenseAccountId?: string }) => void }) {
  const [accountId, setAccountId] = useState(category?.expenseAccountId ?? "default");
  return <Card><CardHeader><CardTitle>{category ? "Edit category" : "Add category"}</CardTitle></CardHeader><CardContent><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); onSubmit({ name: String(data.get("name") ?? "").trim(), ...(accountId === "default" ? {} : { expenseAccountId: accountId }) }); }}>{error ? <Alert variant="destructive"><AlertTitle>Could not save category</AlertTitle><AlertDescription>{getApiError(error).message}</AlertDescription></Alert> : null}<div className="space-y-2"><Label htmlFor="category-name">Category name</Label><Input id="category-name" name="name" required defaultValue={category?.name ?? ""} placeholder="e.g. Utilities" /></div><div className="space-y-2"><Label htmlFor="expense-account">Expense account</Label><Select value={accountId} onValueChange={setAccountId}><SelectTrigger id="expense-account" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="default">Use fallback expense account</SelectItem>{accounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.code} · {account.name}</SelectItem>)}</SelectContent></Select></div><div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" onClick={onCancel} disabled={pending}>Cancel</Button><Button type="submit" disabled={pending}>{pending ? <LoaderCircle className="animate-spin" /> : <Check />}{pending ? "Saving…" : "Save category"}</Button></div></form></CardContent></Card>;
}
