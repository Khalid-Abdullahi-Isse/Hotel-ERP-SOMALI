"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LoaderCircle, Check, X, Banknote, RotateCcw } from "lucide-react";
import { getApiError } from "@/lib/api-error";
import { expensesService } from "@/services/expenses.service";
import type { ExpenseStatus } from "@/types/finance";

export function ExpenseStatusBadge({ status, reversed }: { status: ExpenseStatus; reversed?: boolean }) {
  if (reversed) return <Badge variant="outline">Reversed</Badge>;
  const map: Record<ExpenseStatus, { label: string; variant: "secondary" | "default" | "outline" | "destructive" }> = {
    DRAFT: { label: "Draft", variant: "outline" },
    SUBMITTED: { label: "Submitted", variant: "secondary" },
    PENDING_APPROVAL: { label: "Pending Approval", variant: "secondary" },
    APPROVED: { label: "Approved", variant: "default" },
    PAID: { label: "Paid", variant: "default" },
    REJECTED: { label: "Rejected", variant: "destructive" },
  };
  const entry = map[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}

type Props = {
  expenseId: string;
  status: ExpenseStatus;
  reversed: boolean;
  canApprove: boolean;
  canReject: boolean;
  canPay: boolean;
  canSubmit: boolean;
  canReverse: boolean;
};

export function ExpenseActions({ expenseId, status, reversed, canApprove, canReject, canPay, canSubmit, canReverse }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "submit" | "approve" | "reject" | "pay" | "reverse">(null);
  const [error, setError] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [reverseOpen, setReverseOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reverseReason, setReverseReason] = useState("");
  const [payMethod, setPayMethod] = useState("");

  if (reversed) return null;

  const run = async (action: Props["status"] extends never ? "submit" | "approve" | "pay" : "submit" | "approve" | "reject" | "pay" | "reverse", fn: () => Promise<unknown>) => {
    setBusy(action);
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (err) {
      setError(getApiError(err).message);
    } finally {
      setBusy(null);
    }
  };

  const showSubmit = canSubmit && status === "DRAFT";
  const showApprove = canApprove && status === "SUBMITTED";
  const showReject = canReject && (status === "SUBMITTED" || status === "PENDING_APPROVAL");
  const showPay = canPay && status === "APPROVED";
  const showReverse = canReverse && (status === "PAID" || status === "APPROVED");

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {showSubmit && (
          <Button size="sm" onClick={() => run("submit", () => expensesService.submit(expenseId))} disabled={busy !== null}>
            {busy === "submit" ? <LoaderCircle className="animate-spin" /> : <Check />}Submit
          </Button>
        )}
        {showApprove && (
          <Button size="sm" onClick={() => run("approve", () => expensesService.approve(expenseId))} disabled={busy !== null}>
            {busy === "approve" ? <LoaderCircle className="animate-spin" /> : <Check />}Approve
          </Button>
        )}
        {showReject && (
          <Button size="sm" variant="destructive" onClick={() => { setRejectOpen(true); }} disabled={busy !== null}>
            <X />Reject
          </Button>
        )}
        {showPay && (
          <Button size="sm" variant="outline" onClick={() => { setPayOpen(true); }} disabled={busy !== null}>
            {busy === "pay" ? <LoaderCircle className="animate-spin" /> : <Banknote />}Mark paid
          </Button>
        )}
        {showReverse && (
          <Button size="sm" variant="ghost" onClick={() => { setReverseOpen(true); }} disabled={busy !== null}>
            <RotateCcw />Reverse
          </Button>
        )}
      </div>
      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}

      <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Reject expense</AlertDialogTitle></AlertDialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              run("reject", () => expensesService.reject(expenseId, reason.trim()));
              setRejectOpen(false);
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="reject-reason">Reason</Label>
              <Textarea id="reject-reason" required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Required reason for rejection" rows={3} />
            </div>
            <AlertDialogFooter>
              <Button type="button" variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
              <Button type="submit" variant="destructive" disabled={busy !== null}>Reject</Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={payOpen} onOpenChange={setPayOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Mark expense as paid</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogDescription className="sr-only">Confirm the expense payment</AlertDialogDescription>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              run("pay", () => expensesService.pay(expenseId, payMethod ? { paymentMethodId: payMethod } : {}));
              setPayOpen(false);
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="pay-method">Payment method ID (optional)</Label>
              <input id="pay-method" className="w-full rounded-md border px-3 py-2 text-sm" value={payMethod} onChange={(e) => setPayMethod(e.target.value)} placeholder="Leave empty to use the expense default" type="text" />
            </div>
            <AlertDialogFooter>
              <Button type="button" variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={busy !== null}>{busy === "pay" ? <LoaderCircle className="animate-spin" /> : <Banknote />}Confirm payment</Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={reverseOpen} onOpenChange={setReverseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Reverse expense</AlertDialogTitle></AlertDialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              run("reverse", () => expensesService.reverse(expenseId, reverseReason.trim()));
              setReverseOpen(false);
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="reverse-reason">Reason</Label>
              <Textarea id="reverse-reason" required value={reverseReason} onChange={(e) => setReverseReason(e.target.value)} placeholder="Required reason for reversal" rows={3} />
            </div>
            <AlertDialogFooter>
              <Button type="button" variant="outline" onClick={() => setReverseOpen(false)}>Cancel</Button>
              <Button type="submit" variant="destructive" disabled={busy !== null}>{busy === "reverse" ? <LoaderCircle className="animate-spin" /> : <RotateCcw />}Confirm reversal</Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
