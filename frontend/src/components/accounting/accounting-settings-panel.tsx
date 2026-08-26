"use client";

import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, LoaderCircle, ShieldCheck, WandSparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getApiError } from "@/lib/api-error";
import { accountingService } from "@/services/accounting.service";
import type { AccountingAccount, AccountingSettings, AccountingSettingsInput, AccountType } from "@/types/accounting";

const mappingFields: Array<{
  key: Exclude<keyof AccountingSettingsInput, "discountPostingMode">;
  label: string;
  description: string;
  type: AccountType;
}> = [
  { key: "defaultRoomRevenueAccountId", label: "Room revenue", description: "Nightly room charges", type: "REVENUE" },
  { key: "defaultServiceRevenueAccountId", label: "Service revenue", description: "Unmapped services and other charges", type: "REVENUE" },
  { key: "defaultDiscountAccountId", label: "Sales discounts", description: "Discounts and price reductions", type: "REVENUE" },
  { key: "defaultGuestReceivableAccountId", label: "Guest receivables", description: "Open guest folio balances", type: "ASSET" },
  { key: "defaultCashAccountId", label: "Cash", description: "Front desk cash collections", type: "ASSET" },
  { key: "defaultBankAccountId", label: "Bank / card", description: "Bank and card settlements", type: "ASSET" },
  { key: "defaultMobileMoneyAccountId", label: "Mobile money", description: "Wallet and mobile collections", type: "ASSET" },
  { key: "defaultDepositAccountId", label: "Guest deposits", description: "Advance payments before revenue is earned", type: "LIABILITY" },
  { key: "defaultTaxPayableAccountId", label: "Taxes payable", description: "Tax collected from guests", type: "LIABILITY" },
  { key: "defaultAccountsPayableAccountId", label: "Accounts payable", description: "Expenses not paid immediately", type: "LIABILITY" },
  { key: "defaultExpenseAccountId", label: "Fallback expense", description: "Expense categories without a specific mapping", type: "EXPENSE" },
];

export function AccountingSettingsPanel({ settings, accounts, canManage }: {
  settings: AccountingSettings | null;
  accounts: AccountingAccount[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState<AccountingSettingsInput | null>(() => settings ? settingsInput(settings) : null);
  const initialize = useMutation({
    mutationFn: accountingService.initialize,
    onSuccess: () => router.refresh(),
  });
  const save = useMutation({
    mutationFn: accountingService.updateSettings,
    onSuccess: (next) => {
      setValues(settingsInput(next));
      router.refresh();
    },
  });

  if (!settings || !values) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex min-h-80 flex-col items-center justify-center px-6 text-center">
          <div className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary"><WandSparkles className="size-6" /></div>
          <h2 className="mt-5 text-xl font-semibold">Initialize hotel accounting</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Create the standard hotel chart of accounts, operational journals, and safe default mappings. Existing compatible records are preserved.</p>
          {initialize.error ? <Alert variant="destructive" className="mt-5 max-w-xl text-left"><AlertTitle>Initialization failed</AlertTitle><AlertDescription>{getApiError(initialize.error).message}</AlertDescription></Alert> : null}
          {canManage ? <Button className="mt-6" size="lg" disabled={initialize.isPending} aria-busy={initialize.isPending} onClick={() => initialize.mutate()}>{initialize.isPending ? <LoaderCircle className="animate-spin" /> : <WandSparkles />}{initialize.isPending ? "Initializing…" : "Initialize accounting"}</Button> : <p className="mt-5 text-sm font-medium">Accounting management permission is required.</p>}
        </CardContent>
      </Card>
    );
  }

  return (
    <form className="space-y-6" onSubmit={(event) => { event.preventDefault(); save.mutate(values); }}>
      <Alert>
        <ShieldCheck />
        <AlertTitle>Posting controls are active</AlertTitle>
        <AlertDescription>Every mapping is validated against an active account in this hotel before it can be saved.</AlertDescription>
      </Alert>
      <Card>
        <CardHeader>
          <CardTitle>Default ledger mappings</CardTitle>
          <CardDescription>These accounts connect hotel operations to double-entry posting in {settings.baseCurrency}.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {mappingFields.map((field) => {
            const options = accounts.filter((account) => account.type === field.type && account.isActive);
            return <div className="space-y-2" key={field.key}>
              <Label htmlFor={field.key}>{field.label}</Label>
              <Select value={values[field.key]} onValueChange={(value) => setValues((current) => current ? { ...current, [field.key]: value } : current)} disabled={!canManage}>
                <SelectTrigger id={field.key} className="w-full"><SelectValue placeholder={`Choose ${field.type.toLowerCase()} account`} /></SelectTrigger>
                <SelectContent>{options.map((account) => <SelectItem value={account.id} key={account.id}>{account.code} · {account.name}</SelectItem>)}</SelectContent>
              </Select>
              <p className="text-xs leading-5 text-muted-foreground">{field.description}</p>
            </div>;
          })}
          <div className="space-y-2">
            <Label htmlFor="discountPostingMode">Discount posting</Label>
            <Select value={values.discountPostingMode} onValueChange={(value: AccountingSettingsInput["discountPostingMode"]) => setValues((current) => current ? { ...current, discountPostingMode: value } : current)} disabled={!canManage}>
              <SelectTrigger id="discountPostingMode" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="CONTRA_REVENUE">Contra revenue account</SelectItem><SelectItem value="REDUCE_REVENUE">Reduce original revenue</SelectItem></SelectContent>
            </Select>
            <p className="text-xs leading-5 text-muted-foreground">Controls how guest discounts affect revenue reporting.</p>
          </div>
        </CardContent>
      </Card>
      {save.error ? <Alert variant="destructive"><AlertTitle>Could not save mappings</AlertTitle><AlertDescription>{getApiError(save.error).message}</AlertDescription></Alert> : null}
      {save.isSuccess ? <p className="flex items-center gap-2 text-sm font-medium text-primary" role="status"><CheckCircle2 className="size-4" />Accounting mappings saved.</p> : null}
      {canManage ? <div className="flex justify-end"><Button type="submit" disabled={save.isPending} aria-busy={save.isPending}>{save.isPending ? <LoaderCircle className="animate-spin" /> : null}{save.isPending ? "Saving…" : "Save mappings"}</Button></div> : null}
    </form>
  );
}

function settingsInput(settings: AccountingSettings): AccountingSettingsInput {
  return {
    discountPostingMode: settings.discountPostingMode,
    defaultRoomRevenueAccountId: settings.defaultRoomRevenueAccountId,
    defaultGuestReceivableAccountId: settings.defaultGuestReceivableAccountId,
    defaultCashAccountId: settings.defaultCashAccountId,
    defaultBankAccountId: settings.defaultBankAccountId,
    defaultMobileMoneyAccountId: settings.defaultMobileMoneyAccountId,
    defaultDepositAccountId: settings.defaultDepositAccountId,
    defaultTaxPayableAccountId: settings.defaultTaxPayableAccountId,
    defaultServiceRevenueAccountId: settings.defaultServiceRevenueAccountId,
    defaultDiscountAccountId: settings.defaultDiscountAccountId,
    defaultExpenseAccountId: settings.defaultExpenseAccountId,
    defaultAccountsPayableAccountId: settings.defaultAccountsPayableAccountId,
  };
}
