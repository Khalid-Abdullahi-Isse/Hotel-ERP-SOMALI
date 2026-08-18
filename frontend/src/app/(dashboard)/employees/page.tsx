import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { UsersTable } from "@/components/settings/users-table";
import { Card } from "@/components/ui/card";
import { getSystemUsers } from "@/services/system.server";

export const metadata: Metadata = { title: "Employees" };
export default async function EmployeesPage() {
  const users = await getSystemUsers();
  return <div className="space-y-6"><PageHeader title="Employees" description="Hotel staff accounts and assigned roles." /><Card className="py-0"><UsersTable users={users} /></Card></div>;
}
