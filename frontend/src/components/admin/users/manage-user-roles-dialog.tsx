"use client";

import { LoaderCircle, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { getApiError } from "@/lib/api-error";
import { adminService } from "@/services/admin.service";
import type { AdminRole, AdminUser } from "@/types/admin";

export function ManageUserRolesDialog({ user, roles, isSelf }: { user: AdminUser; roles: AdminRole[]; isSelf: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(user.roles.map((role) => role.id));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const originalAdmin = user.roles.some((role) => role.name === "ADMIN");
  const selectedAdmin = roles.some((role) => role.name === "ADMIN" && selected.includes(role.id));
  const highRisk = originalAdmin !== selectedAdmin || isSelf;
  async function save() {
    setPending(true); setError(null);
    try { await adminService.assignRoles(user.id, selected); setOpen(false); router.refresh(); }
    catch (reason) { setError(getApiError(reason).message); }
    finally { setPending(false); }
  }
  return <AlertDialog open={open} onOpenChange={(value) => { if (!pending) { setOpen(value); setSelected(user.roles.map((role) => role.id)); setError(null); } }}>
    <AlertDialogTrigger asChild><Button variant="outline"><ShieldCheck />Manage roles</Button></AlertDialogTrigger>
    <AlertDialogContent className="sm:max-w-lg"><AlertDialogHeader><AlertDialogTitle>Manage roles for {user.fullName}</AlertDialogTitle><AlertDialogDescription>{highRisk ? "This may change administrative access. The backend will prevent removal of the hotel's final active administrator." : "The selected roles replace the user's current role assignments after backend validation."}</AlertDialogDescription></AlertDialogHeader>
      <div className="max-h-72 space-y-2 overflow-y-auto">{roles.filter((role) => role.isActive).map((role) => <label key={role.id} className="flex cursor-pointer gap-3 rounded-lg border p-3"><input type="checkbox" className="mt-1 size-4" checked={selected.includes(role.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, role.id] : selected.filter((id) => id !== role.id))} /><span><span className="font-medium">{role.name}</span>{role.isSystem ? <span className="ml-2 text-xs text-muted-foreground">System role</span> : null}<span className="block text-xs text-muted-foreground">{role.description || `${role.permissions.length} permissions`}</span></span></label>)}</div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}<AlertDialogFooter><AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel><AlertDialogAction disabled={pending || selected.length === 0} onClick={(event) => { event.preventDefault(); void save(); }}>{pending ? <><LoaderCircle className="animate-spin" />Saving...</> : selectedAdmin && !originalAdmin ? "Grant administrator access" : "Save roles"}</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
