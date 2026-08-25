import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { UsersTable } from "@/components/settings/users-table";
import { Card } from "@/components/ui/card";
import { getSystemUsers } from "@/services/system.server";
import { Pagination } from "@/components/shared/pagination";
import { ListToolbar } from "@/components/shared/list-toolbar";
import { parsePage } from "@/lib/pagination";
import { Suspense } from "react";
import { redirectOutOfRangePage } from "@/lib/pagination.server";

export const metadata: Metadata = { title: "Employees" };
export default async function EmployeesPage({ searchParams }: { searchParams: Promise<{ page?: string; search?: string; status?: string }> }) {
  const params = await searchParams; const users = await getSystemUsers({ page: parsePage(params.page), search: params.search, status: params.status });
  redirectOutOfRangePage(parsePage(params.page), users.pagination.totalPages, "/employees", params);
  return <div className="space-y-6"><PageHeader title="Employees" description="Hotel staff accounts and assigned roles." /><Card className="py-0"><Suspense fallback={<div className="h-17 border-b" />}><ListToolbar placeholder="Search employee, email, or role" statuses={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }, { value: "locked", label: "Locked" }]} /></Suspense><UsersTable users={users.data} /><Pagination {...users.pagination} itemLabel="employees" searchParams={{ search: params.search, status: params.status }} /></Card></div>;
}
