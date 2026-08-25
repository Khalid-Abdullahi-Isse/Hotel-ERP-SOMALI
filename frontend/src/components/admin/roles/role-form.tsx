"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorMessage } from "@/components/shared/error-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PermissionSelector } from "@/components/admin/roles/permission-selector";
import { getApiError } from "@/lib/api-error";
import { createAdminRoleSchema } from "@/schemas/admin.schema";
import { adminService } from "@/services/admin.service";

export function RoleForm({ permissions }: { permissions: Array<{ key: string; description: string | null }> }) {
  const router = useRouter();
  const [name, setName] = useState(""); const [description, setDescription] = useState(""); const [selected, setSelected] = useState<string[]>([]); const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); const parsed = createAdminRoleSchema.safeParse({ name, description: description || undefined, permissionKeys: selected });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Review the role details."); return; }
    setPending(true); setError(null);
    try { const role = await adminService.createRole(parsed.data); router.push(`/admin/roles/${role.id}`); router.refresh(); }
    catch (reason) { setError(getApiError(reason).message); }
    finally { setPending(false); }
  }
  return <form onSubmit={submit} className="space-y-5" noValidate>{error ? <ErrorMessage title="Unable to create role" message={error} /> : null}<Card><CardHeader><CardTitle>Role details</CardTitle></CardHeader><CardContent className="grid gap-5 border-t pt-6 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="role-name">Role name</Label><Input id="role-name" value={name} onChange={(event) => setName(event.target.value.toUpperCase())} maxLength={64} placeholder="NIGHT SUPERVISOR" /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="role-description">Description</Label><Textarea id="role-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={3} /></div></CardContent></Card><Card><CardHeader><CardTitle>Permissions</CardTitle><p className="text-sm text-muted-foreground">Choose only the access this role requires.</p></CardHeader><CardContent className="border-t pt-6"><PermissionSelector permissions={permissions} selected={selected} onChange={setSelected} disabled={pending} /></CardContent><CardFooter className="justify-end gap-2 border-t"><Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>Cancel</Button><Button type="submit" disabled={pending}>{pending ? <><LoaderCircle className="animate-spin" />Creating...</> : "Create role"}</Button></CardFooter></Card></form>;
}
