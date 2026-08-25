import type { Metadata } from "next";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { AdminUsersTable } from "@/components/admin/users/users-table";
import { UsersToolbar } from "@/components/admin/users/users-toolbar";
import { parsePage } from "@/lib/pagination";
import { redirectOutOfRangePage } from "@/lib/pagination.server";
import { getCurrentUser } from "@/services/auth.server";
import { getAdminUsers } from "@/services/admin.server";

export const metadata: Metadata = { title: "User Management" };
export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ page?: string; search?: string; status?: string }> }) {
  const params = await searchParams; const page = parsePage(params.page); const status = params.status === "active" || params.status === "inactive" || params.status === "locked" ? params.status : undefined; const search = params.search?.slice(0, 160); const [users, currentUser] = await Promise.all([getAdminUsers({ page, search, status }), getCurrentUser()]);
  redirectOutOfRangePage(page, users.pagination.totalPages, "/admin/users", { search, status });
  return <div className="space-y-6"><PageHeader title="User Management" description="Manage staff accounts, access roles, permissions, and account status." actions={<Button asChild><Link href="/admin/users/new"><UserPlus />Add user</Link></Button>} /><Card className="py-0"><Suspense fallback={<div className="h-17 border-b" />}><UsersToolbar /></Suspense><AdminUsersTable users={users.data} currentUserId={currentUser!.id} filtered={Boolean(search || status)} /><Pagination {...users.pagination} itemLabel="users" searchParams={{ search, status }} /></Card></div>;
}
