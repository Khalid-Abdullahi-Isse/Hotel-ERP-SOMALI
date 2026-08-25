"use client";

import { LoaderCircle, KeyRound } from "lucide-react";
import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiError } from "@/lib/api-error";
import { resetAdminPasswordSchema } from "@/schemas/admin.schema";
import { adminService } from "@/services/admin.service";

export function ResetPasswordDialog({ userId, userName }: { userId: string; userName: string }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function reset() {
    const parsed = resetAdminPasswordSchema.safeParse({ password });
    if (!parsed.success) { setMessage(parsed.error.issues[0]?.message ?? "Enter a valid password."); return; }
    setPending(true); setMessage(null);
    try { await adminService.resetPassword(userId, parsed.data.password); setPassword(""); setOpen(false); }
    catch (reason) { setMessage(getApiError(reason).message); }
    finally { setPassword(""); setPending(false); }
  }
  return <AlertDialog open={open} onOpenChange={(value) => { if (!pending) { setOpen(value); setPassword(""); setMessage(null); } }}>
    <AlertDialogTrigger asChild><Button variant="outline"><KeyRound />Reset password</Button></AlertDialogTrigger>
    <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Reset password for {userName}?</AlertDialogTitle><AlertDialogDescription>A new temporary password will replace the current password and all of this user&apos;s active sessions will be revoked.</AlertDialogDescription></AlertDialogHeader>
      <div className="space-y-2"><Label htmlFor="new-password">New temporary password</Label><Input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={12} maxLength={128} /><p className="text-xs text-muted-foreground">Use at least 12 characters and share it securely.</p></div>
      {message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null}<AlertDialogFooter><AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel><AlertDialogAction disabled={pending || password.length < 12} onClick={(event) => { event.preventDefault(); void reset(); }}>{pending ? <><LoaderCircle className="animate-spin" />Resetting...</> : "Reset password"}</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
