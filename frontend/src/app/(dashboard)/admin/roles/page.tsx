import type { Metadata } from "next";
import Link from "next/link";
import { ShieldPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { RolesTable } from "@/components/admin/roles/roles-table";
import { getAdminRoles } from "@/services/admin.server";

export const metadata: Metadata = { title: "Roles & Permissions" };
export default async function AdminRolesPage() { const roles = await getAdminRoles(); return <div className="space-y-6"><PageHeader title="Roles & Permissions" description="Control what users are allowed to access and manage within the system." actions={<Button asChild><Link href="/admin/roles/new"><ShieldPlus />Add role</Link></Button>} /><Card className="py-0"><RolesTable roles={roles} /></Card></div>; }
