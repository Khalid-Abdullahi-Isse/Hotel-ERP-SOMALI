import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { UserForm } from "@/components/admin/users/user-form";
import { getAdminRoles } from "@/services/admin.server";

export const metadata: Metadata = { title: "Add User" };
export default async function NewAdminUserPage() {
  const roles = await getAdminRoles();
  return <div className="space-y-7"><Button variant="ghost" size="sm" asChild className="-ml-2"><Link href="/admin/users"><ChevronLeft />Back to users</Link></Button><PageHeader title="Add user" description="Create a hotel-scoped staff account and assign its initial access roles." /><UserForm roles={roles} /></div>;
}
