"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorMessage } from "@/components/shared/error-message";
import { getApiError } from "@/lib/api-error";
import { createAdminUserSchema, updateAdminUserSchema, type CreateAdminUserValues, type UpdateAdminUserValues } from "@/schemas/admin.schema";
import { adminService } from "@/services/admin.service";
import type { AdminRole, AdminUser } from "@/types/admin";

const editAdminUserFormSchema = updateAdminUserSchema.extend({
  password: z.string(),
  roleIds: z.array(z.string()),
});

export function UserForm({ user, roles }: { user?: AdminUser; roles: AdminRole[] }) {
  const router = useRouter();
  const [apiError, setApiError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<CreateAdminUserValues | null>(null);
  const [confirming, setConfirming] = useState(false);
  const editing = Boolean(user);
  const form = useForm<CreateAdminUserValues>({
    resolver: zodResolver(editing ? editAdminUserFormSchema : createAdminUserSchema),
    defaultValues: user ? { fullName: user.fullName, email: user.email, username: user.username, password: "", roleIds: user.roles.map((role) => role.id) } : { fullName: "", email: "", username: "", password: "", roleIds: [] },
  });
  const { register, control, formState: { errors, isSubmitting }, handleSubmit } = form;
  async function persist(values: CreateAdminUserValues) {
    setApiError(null);
    try {
      const saved = editing
        ? await adminService.updateUser(user!.id, { fullName: values.fullName, email: values.email, username: values.username } satisfies UpdateAdminUserValues)
        : await adminService.createUser(values);
      form.reset({ ...values, password: "" });
      router.push(`/admin/users/${saved.id}`); router.refresh();
    } catch (reason) {
      if (!editing) form.setValue("password", "");
      setApiError(getApiError(reason).message);
    }
  }
  async function submit(values: CreateAdminUserValues) {
    const grantsAdmin = !editing && roles.some((role) => role.name === "ADMIN" && values.roleIds.includes(role.id));
    if (grantsAdmin) { setConfirmation(values); return; }
    await persist(values);
  }
  return <form onSubmit={handleSubmit(submit)} noValidate className="space-y-5">
    {apiError ? <ErrorMessage title={editing ? "Unable to update user" : "Unable to create user"} message={apiError} /> : null}
    <Card><CardHeader><CardTitle>Account information</CardTitle></CardHeader><CardContent className="grid gap-5 border-t pt-6 sm:grid-cols-2">
      <Field label="Full name" error={errors.fullName?.message}><Input id="fullName" autoComplete="name" aria-invalid={Boolean(errors.fullName)} {...register("fullName")} /></Field>
      <Field label="Email" error={errors.email?.message}><Input id="email" type="email" autoComplete="off" aria-invalid={Boolean(errors.email)} {...register("email")} /></Field>
      <Field label="Username" error={errors.username?.message}><Input id="username" autoCapitalize="none" autoComplete="off" aria-invalid={Boolean(errors.username)} {...register("username")} /></Field>
      {!editing ? <Field label="Temporary password" error={errors.password?.message}><Input id="password" type="password" autoComplete="new-password" aria-invalid={Boolean(errors.password)} {...register("password")} /><p className="text-xs text-muted-foreground">Use at least 12 characters. Share it through a secure channel.</p></Field> : null}
    </CardContent></Card>
    {!editing ? <Card><CardHeader><CardTitle>Role assignment</CardTitle><p className="text-sm text-muted-foreground">Roles are limited to active roles owned by this hotel.</p></CardHeader><CardContent className="space-y-3 border-t pt-6"><Controller name="roleIds" control={control} render={({ field }) => <div className="grid gap-3 sm:grid-cols-2">{roles.filter((role) => role.isActive).map((role) => <label key={role.id} className="flex cursor-pointer gap-3 rounded-lg border p-3"><input type="checkbox" className="mt-1 size-4" checked={field.value.includes(role.id)} onChange={(event) => field.onChange(event.target.checked ? [...field.value, role.id] : field.value.filter((id) => id !== role.id))} /><span><span className="block font-medium">{role.name}</span><span className="text-xs text-muted-foreground">{role.description || `${role.permissions.length} permissions`}</span></span></label>)}</div>} />{errors.roleIds ? <p className="text-sm text-destructive">{errors.roleIds.message}</p> : null}</CardContent></Card> : null}
    <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting || confirming}>Cancel</Button><Button type="submit" disabled={isSubmitting || confirming || (!editing && roles.every((role) => !role.isActive))}>{isSubmitting ? <><LoaderCircle className="animate-spin" />Saving...</> : editing ? "Save changes" : "Create user"}</Button></div>
    <AlertDialog open={Boolean(confirmation)} onOpenChange={(open) => { if (!open && !confirming) setConfirmation(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Grant administrator access?</AlertDialogTitle><AlertDialogDescription>This new user will gain access to administrative functions, including user accounts, roles, and permissions for this hotel.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={confirming}>Cancel</AlertDialogCancel><AlertDialogAction disabled={confirming} onClick={(event) => { event.preventDefault(); if (!confirmation) return; setConfirming(true); void persist(confirmation).finally(() => { setConfirming(false); setConfirmation(null); }); }}>{confirming ? <><LoaderCircle className="animate-spin" />Creating...</> : "Grant access and create"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </form>;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  const id = label === "Temporary password" ? "password" : label.replace(" ", "").replace(/^./, (letter) => letter.toLowerCase());
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{children}{error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}</div>;
}
