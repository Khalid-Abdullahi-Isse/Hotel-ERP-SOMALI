import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { UsersTable } from "@/components/settings/users-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRoles, getSystemUsers } from "@/services/system.server";

export const metadata: Metadata = { title: "Users & Roles" };
export default async function UsersPage() {
  const [users, apiRoles] = await Promise.all([getSystemUsers(), getRoles()]);
  const roles = apiRoles.map((role) => ({
    name: role.name,
    detail: `${role.userCount} users · ${role.permissions.length} permissions`,
  }));
  return (
    <div className="space-y-6">
      <PageHeader
        title="Users & Roles"
        description="Manage which hotel features each role can access."
      />
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card className="py-0">
          <CardHeader className="border-b py-4">
            <CardTitle>System users</CardTitle>
            <p className="text-xs text-muted-foreground">
              Accounts with access to this property
            </p>
          </CardHeader>
          <UsersTable users={users} />
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
