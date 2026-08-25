import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { UserForm } from "@/components/admin/users/user-form";
import { ApiError } from "@/lib/api-error";
import { getAdminRoles, getAdminUser } from "@/services/admin.server";

export const metadata: Metadata = { title: "Edit User" };
export default async function EditAdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; let user: Awaited<ReturnType<typeof getAdminUser>>; let roles: Awaited<ReturnType<typeof getAdminRoles>>;
  try { [user, roles] = await Promise.all([getAdminUser(id), getAdminRoles()]); } catch (error) { if (error instanceof ApiError && error.status === 404) notFound(); throw error; }
  return <div className="space-y-7"><Button variant="ghost" size="sm" asChild className="-ml-2"><Link href={`/admin/users/${user.id}`}><ChevronLeft />Back to user</Link></Button><PageHeader title={`Edit ${user.fullName}`} description="Update mutable account profile fields. Role and account-state changes are managed separately." /><UserForm user={user} roles={roles} /></div>;
}
