import Link from "next/link";
import { Shield, ShieldPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AdminRole } from "@/types/admin";

export function RolesTable({ roles }: { roles: AdminRole[] }) {
  if (!roles.length) return <EmptyState icon={Shield} title="No roles found" description="Create a role to define access for hotel staff." action={<Button asChild><Link href="/admin/roles/new"><ShieldPlus />Add role</Link></Button>} />;
  return <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Role</TableHead><TableHead>Users</TableHead><TableHead>Permissions</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{roles.map((role) => <TableRow key={role.id}><TableCell><Link href={`/admin/roles/${role.id}`} className="font-medium hover:underline">{role.name}</Link><p className="max-w-md truncate text-xs text-muted-foreground">{role.description || "No description"}</p></TableCell><TableCell>{role.userCount}</TableCell><TableCell>{role.permissions.length}</TableCell><TableCell>{role.isSystem ? <Badge variant="secondary">System</Badge> : <Badge variant="outline">Custom</Badge>}</TableCell><TableCell><Badge variant="outline" className={role.isActive ? "border-status-success/25 text-status-success" : "text-muted-foreground"}>{role.isActive ? "Active" : "Inactive"}</Badge></TableCell><TableCell className="text-right"><Button variant="ghost" size="sm" asChild><Link href={`/admin/roles/${role.id}`}>View role</Link></Button></TableCell></TableRow>)}</TableBody></Table></div>;
}
