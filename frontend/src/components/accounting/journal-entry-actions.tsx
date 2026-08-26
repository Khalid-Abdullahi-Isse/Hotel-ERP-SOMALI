"use client";

import { useMutation } from "@tanstack/react-query";
import { LoaderCircle, RotateCcw, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getApiError } from "@/lib/api-error";
import { accountingService } from "@/services/accounting.service";

export function JournalEntryActions({ entryId, status, canPost, canReverse }: { entryId: string; status: "DRAFT" | "POSTED" | "REVERSED"; canPost: boolean; canReverse: boolean }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const mutation = useMutation({ mutationFn: (operation: "post" | "reverse") => operation === "post" ? accountingService.postEntry(entryId) : accountingService.reverseEntry(entryId, reason.trim()), onSuccess: () => { setReason(""); router.refresh(); } });
  return <div className="space-y-3">
    <div className="flex flex-wrap gap-2">{status === "DRAFT" && canPost ? <Button onClick={() => mutation.mutate("post")} disabled={mutation.isPending} aria-busy={mutation.isPending}>{mutation.isPending ? <LoaderCircle className="animate-spin" /> : <Send />}{mutation.isPending ? "Posting…" : "Post to ledger"}</Button> : null}
      {status === "POSTED" && canReverse ? <AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" disabled={mutation.isPending}><RotateCcw />Reverse entry</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Reverse this posted entry?</AlertDialogTitle><AlertDialogDescription>A new opposite entry will be posted. The original remains visible for audit history.</AlertDialogDescription></AlertDialogHeader><div className="space-y-2"><Label htmlFor="reversal-reason">Reason</Label><Textarea id="reversal-reason" value={reason} onChange={(event) => setReason(event.target.value)} minLength={3} maxLength={255} placeholder="Explain why this reversal is required" /></div><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={reason.trim().length < 3 || mutation.isPending} onClick={() => mutation.mutate("reverse")}>Confirm reversal</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog> : null}
    </div>
    {mutation.error ? <Alert variant="destructive"><AlertTitle>Accounting action failed</AlertTitle><AlertDescription>{getApiError(mutation.error).message}</AlertDescription></Alert> : null}
  </div>;
}
