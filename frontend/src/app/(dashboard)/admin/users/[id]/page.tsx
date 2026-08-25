import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ChevronLeft, Clock3, Mail, Pencil, ShieldCheck, UserRound } from "lucide-react";
import { notFound } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionGroups } from "@/components/admin/permission-groups";
import { formatAdminDate, initials } from "@/components/admin/admin-format";
import { ManageUserRolesDialog } from "@/components/admin/users/manage-user-roles-dialog";
import { ResetPasswordDialog } from "@/components/admin/users/reset-password-dialog";
import { UserLifecycleDialog } from "@/components/admin/users/user-lifecycle-dialog";
import { UserStatusBadge } from "@/components/admin/users/user-status-badge";
import { ApiError } from "@/lib/api-error";
import { PERMISSIONS } from "@/constants/permissions";
import { getAdminRoles, getAdminUser, getUserAuthActivity } from "@/services/admin.server";
import { getCurrentUser } from "@/services/auth.server";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> { const { id } = await params; return { title: `User ${id}` }; }
export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let user: Awaited<ReturnType<typeof getAdminUser>>; let roles: Awaited<ReturnType<typeof getAdminRoles>>; let current: Awaited<ReturnType<typeof getCurrentUser>>;
  try { [user, roles, current] = await Promise.all([getAdminUser(id), getAdminRoles(), getCurrentUser()]); } catch (error) { if (error instanceof ApiError && error.status === 404) notFound(); throw error; }
  const activity = current!.permissions.includes(PERMISSIONS.auditsRead) ? await getUserAuthActivity(id) : null;
  const isSelf = current!.id === user.id;
  const roleDetails = user.roles.map((assigned) => roles.find((role) => role.id === assigned.id)).filter((role): role is NonNullable<typeof role> => Boolean(role));
  const permissions = [...new Map(roleDetails.flatMap((role) => role.permissions).map((permission) => [permission.key, permission])).values()].sort((left, right) => left.key.localeCompare(right.key));
  return <div className="space-y-7"><Button variant="ghost" size="sm" asChild className="-ml-2"><Link href="/admin/users"><ChevronLeft />Back to users</Link></Button>
    <PageHeader title={user.fullName} description={`${user.username} · ${user.email}`} actions={<><Button asChild variant="outline"><Link href={`/admin/users/${user.id}/edit`}><Pencil />Edit user</Link></Button><ManageUserRolesDialog user={user} roles={roles} isSelf={isSelf} /><ResetPasswordDialog userId={user.id} userName={user.fullName} />{user.status === "INACTIVE" ? <UserLifecycleDialog userId={user.id} userName={user.fullName} action="restore" /> : user.status === "LOCKED" ? <UserLifecycleDialog userId={user.id} userName={user.fullName} action="unlock" /> : <UserLifecycleDialog userId={user.id} userName={user.fullName} action="deactivate" isSelf={isSelf} />}</>} />
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)]"><Card><CardHeader className="flex-row items-center justify-between"><div className="flex items-center gap-3"><Avatar className="size-12"><AvatarFallback>{initials(user.fullName)}</AvatarFallback></Avatar><div><CardTitle>Account overview</CardTitle>{isSelf ? <Badge variant="secondary" className="mt-1">Your account</Badge> : null}</div></div><UserStatusBadge status={user.status} /></CardHeader><CardContent className="grid gap-6 border-t pt-6 sm:grid-cols-2"><Info icon={UserRound} label="Full name" value={user.fullName} /><Info icon={Mail} label="Email" value={user.email} /><Info icon={CalendarDays} label="Created" value={formatAdminDate(user.createdAt, true)} /><Info icon={Clock3} label="Last login" value={formatAdminDate(user.lastLoginAt, true)} /><Info icon={Clock3} label="Last updated" value={formatAdminDate(user.updatedAt, true)} /><Info icon={ShieldCheck} label="Failed sign-in attempts" value={String(user.failedLoginAttempts)} /></CardContent></Card>
      <Card><CardHeader><CardTitle>Roles</CardTitle></CardHeader><CardContent className="space-y-3 border-t pt-6">{roleDetails.map((role) => <Link href={`/admin/roles/${role.id}`} key={role.id} className="block rounded-lg border p-3 hover:bg-muted/40"><div className="flex items-center justify-between gap-3"><span className="font-medium">{role.name}</span>{role.isSystem ? <Badge variant="secondary">System</Badge> : null}</div><p className="mt-1 text-xs text-muted-foreground">{role.permissions.length} permissions</p></Link>)}</CardContent></Card></div>
    <Card><CardHeader><CardTitle>Access granted through assigned roles</CardTitle><p className="text-sm text-muted-foreground">This is a display of role permissions returned by the backend. Authorization is evaluated by the backend on every request.</p></CardHeader><CardContent className="border-t pt-6"><PermissionGroups permissions={permissions} /></CardContent></Card>
    {activity ? <Card><CardHeader><CardTitle>Actions performed by this user</CardTitle><p className="text-sm text-muted-foreground">Recent hotel-scoped audit entries where this account was the acting user.</p></CardHeader><CardContent className="border-t pt-2">{activity.data.length ? <ul className="divide-y">{activity.data.map((entry) => <li key={entry.id} className="flex items-start justify-between gap-4 py-4"><div><p className="text-sm font-medium">{entry.action.replaceAll(".", " ")}</p><p className="text-xs text-muted-foreground">{entry.entityType}</p></div><time className="shrink-0 text-xs text-muted-foreground">{formatAdminDate(entry.createdAt, true)}</time></li>)}</ul> : <p className="py-8 text-center text-sm text-muted-foreground">No recent activity is available.</p>}</CardContent></Card> : null}
  </div>;
}

function Info({ icon: Icon, label, value }: { icon: typeof UserRound; label: string; value: string }) { return <div className="flex gap-3"><div className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted"><Icon className="size-4 text-muted-foreground" aria-hidden="true" /></div><div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 break-words text-sm font-medium">{value}</p></div></div>; }
