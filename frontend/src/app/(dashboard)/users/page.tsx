import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { UsersTable } from "@/components/settings/users-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRoles, getSystemUsers } from "@/services/system.server";
import { Pagination } from "@/components/shared/pagination";
import { ListToolbar } from "@/components/shared/list-toolbar";
import { parsePage } from "@/lib/pagination";
import { Suspense } from "react";
import { redirectOutOfRangePage } from "@/lib/pagination.server";

export const metadata: Metadata = { title: "Users & Roles" };
export default async function UsersPage({ searchParams }: { searchParams: Promise<{ page?: string; search?: string; status?: string }> }) {
  const params = await searchParams;
  const [users, apiRoles] = await Promise.all([getSystemUsers({ page: parsePage(params.page), search: params.search, status: params.status }), getRoles()]);
  redirectOutOfRangePage(parsePage(params.page), users.pagination.totalPages, "/users", params);
  const roles = apiRoles.map((role) => ({
    name: role.name,
    detail: `${role.userCount} users · ${role.permissions.length} permissions`,
  }));
  return (
    <div className="space-y-6">
      <PageHeader
        title="Users & Roles"
        description="Review hotel accounts, assigned roles, and permission coverage."
      />
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card className="py-0">
          <CardHeader className="border-b py-4">
            <CardTitle>System users</CardTitle>
            <p className="text-xs text-muted-foreground">
              Accounts with access to this property
            </p>
          </CardHeader>
          <Suspense fallback={<div className="h-17 border-b" />}><ListToolbar placeholder="Search name, email, username, or role" statuses={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }, { value: "locked", label: "Locked" }]} /></Suspense>
          <UsersTable users={users.data} />
          <Pagination {...users.pagination} itemLabel="users" searchParams={{ search: params.search, status: params.status }} />
        </Card>
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" />
              Role overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {roles.map((role) => (
              <div
                key={role.name}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <p className="font-medium">{role.name}</p>
                <p className="text-xs text-muted-foreground">{role.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
