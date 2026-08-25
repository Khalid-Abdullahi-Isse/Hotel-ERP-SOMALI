import Link from "next/link";
import { Eye, Pencil, UserPlus, Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatAdminDate, initials } from "@/components/admin/admin-format";
import { UserLifecycleDialog } from "@/components/admin/users/user-lifecycle-dialog";
import { UserStatusBadge } from "@/components/admin/users/user-status-badge";
import type { AdminUser } from "@/types/admin";

export function AdminUsersTable({ users, currentUserId, filtered }: { users: AdminUser[]; currentUserId: string; filtered: boolean }) {
  if (!users.length) return <EmptyState icon={Users} title={filtered ? "No users found" : "No users yet"} description={filtered ? "Try changing your search or status filter." : "Create the first staff account to start managing access."} action={!filtered ? <Button asChild><Link href="/admin/users/new"><UserPlus />Add user</Link></Button> : undefined} />;
  return <div className="overflow-x-auto"><Table>
    <TableHeader><TableRow><TableHead>User</TableHead><TableHead>Roles</TableHead><TableHead>Status</TableHead><TableHead className="hidden lg:table-cell">Last login</TableHead><TableHead className="hidden xl:table-cell">Created</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
    <TableBody>{users.map((user) => { const isSelf = user.id === currentUserId; return <TableRow key={user.id}>
      <TableCell><div className="flex min-w-64 items-center gap-3"><Avatar className="size-9"><AvatarFallback>{initials(user.fullName)}</AvatarFallback></Avatar><div className="min-w-0"><div className="flex items-center gap-2"><Link href={`/admin/users/${user.id}`} className="truncate font-medium hover:underline">{user.fullName}</Link>{isSelf ? <Badge variant="secondary">You</Badge> : null}</div><p className="truncate text-xs text-muted-foreground">{user.email} · @{user.username}</p></div></div></TableCell>
      <TableCell><div className="flex max-w-64 flex-wrap gap-1">{user.roles.length ? user.roles.map((role) => <Badge variant="outline" key={role.id}>{role.name}</Badge>) : <span className="text-sm text-muted-foreground">No role</span>}</div></TableCell>
      <TableCell><UserStatusBadge status={user.status} /></TableCell>
      <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">{formatAdminDate(user.lastLoginAt, true)}</TableCell>
      <TableCell className="hidden text-sm text-muted-foreground xl:table-cell">{formatAdminDate(user.createdAt)}</TableCell>
      <TableCell><div className="flex justify-end gap-1"><Button asChild variant="ghost" size="icon-sm"><Link href={`/admin/users/${user.id}`} aria-label={`View ${user.fullName}`}><Eye /></Link></Button><Button asChild variant="ghost" size="icon-sm"><Link href={`/admin/users/${user.id}/edit`} aria-label={`Edit ${user.fullName}`}><Pencil /></Link></Button>{user.status === "INACTIVE" ? <UserLifecycleDialog compact userId={user.id} userName={user.fullName} action="restore" /> : user.status === "LOCKED" ? <UserLifecycleDialog compact userId={user.id} userName={user.fullName} action="unlock" /> : <UserLifecycleDialog compact userId={user.id} userName={user.fullName} action="deactivate" isSelf={isSelf} />}</div></TableCell>
    </TableRow>; })}</TableBody>
  </Table></div>;
}
