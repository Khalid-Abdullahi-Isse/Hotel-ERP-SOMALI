import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { RoleEditor } from "@/components/admin/roles/role-editor";
import { formatAdminDate } from "@/components/admin/admin-format";
import { getAdminRole, getAvailablePermissions } from "@/services/admin.server";

export const metadata: Metadata = { title: "Role Details" };
export default async function AdminRolePage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; const [role, permissions] = await Promise.all([getAdminRole(id), getAvailablePermissions()]); if (!role) notFound(); return <div className="space-y-7"><Button variant="ghost" size="sm" asChild className="-ml-2"><Link href="/admin/roles"><ChevronLeft />Back to roles</Link></Button><PageHeader title={role.name} description={role.description || "No role description."} actions={<div className="flex gap-2"><Badge variant={role.isSystem ? "secondary" : "outline"}>{role.isSystem ? "System role" : "Custom role"}</Badge><Badge variant="outline">{role.userCount} {role.userCount === 1 ? "user" : "users"}</Badge></div>} /><p className="text-xs text-muted-foreground">Created {formatAdminDate(role.createdAt, true)} · Updated {formatAdminDate(role.updatedAt, true)}</p><RoleEditor role={role} permissions={permissions} /></div>; }
