"use client";

import { LoaderCircle, LockOpen, Power, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { getApiError } from "@/lib/api-error";
import { adminService } from "@/services/admin.service";

type Action = "deactivate" | "restore" | "unlock";

export function UserLifecycleDialog({ userId, userName, action, compact = false, isSelf = false }: { userId: string; userName: string; action: Action; compact?: boolean; isSelf?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const content = {
    deactivate: { label: "Deactivate", title: `Deactivate ${userName}?`, description: isSelf ? "This is your own account. You will immediately lose access and all of your sessions will be revoked. Another administrator must restore the account." : `${userName} will immediately lose access to the Hotel ERP. Historical records remain unchanged. This can be reversed by restoring the account.`, icon: Power },
    restore: { label: "Restore", title: `Restore ${userName}?`, description: `${userName} will be able to sign in again with their existing roles.`, icon: RotateCcw },
    unlock: { label: "Unlock", title: `Unlock ${userName}?`, description: `Failed sign-in attempts will be cleared and ${userName} will be able to try signing in again.`, icon: LockOpen },
  }[action];
  const Icon = content.icon;
  async function confirm() {
    setPending(true); setError(null);
    try {
      if (action === "deactivate") await adminService.deactivateUser(userId);
      else if (action === "restore") await adminService.restoreUser(userId);
      else await adminService.unlockUser(userId);
      setOpen(false); router.refresh();
    } catch (reason) { setError(getApiError(reason).message); }
    finally { setPending(false); }
  }
  return <AlertDialog open={open} onOpenChange={(value) => { if (!pending) { setOpen(value); setError(null); } }}>
    <AlertDialogTrigger asChild><Button variant={compact ? "ghost" : "outline"} size={compact ? "sm" : "default"} className={action === "deactivate" ? "text-destructive hover:text-destructive" : undefined}><Icon />{content.label}</Button></AlertDialogTrigger>
    <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{content.title}</AlertDialogTitle><AlertDialogDescription>{content.description}</AlertDialogDescription></AlertDialogHeader>{error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}<AlertDialogFooter><AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel><AlertDialogAction variant={action === "deactivate" ? "destructive" : "default"} disabled={pending} onClick={(event) => { event.preventDefault(); void confirm(); }}>{pending ? <><LoaderCircle className="animate-spin" />Working...</> : content.label}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
  </AlertDialog>;
}
