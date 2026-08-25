import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { RoleForm } from "@/components/admin/roles/role-form";
import { getAvailablePermissions } from "@/services/admin.server";

export const metadata: Metadata = { title: "Add Role" };
export default async function NewAdminRolePage() { const permissions = await getAvailablePermissions(); return <div className="space-y-7"><Button variant="ghost" size="sm" asChild className="-ml-2"><Link href="/admin/roles"><ChevronLeft />Back to roles</Link></Button><PageHeader title="Add role" description="Create a hotel-scoped role with only the permissions its users require." /><RoleForm permissions={permissions} /></div>; }
