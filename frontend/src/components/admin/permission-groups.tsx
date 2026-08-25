import { Check } from "lucide-react";
import { permissionGroup, permissionLabel } from "@/components/admin/admin-format";

export function PermissionGroups({ permissions }: { permissions: Array<{ key: string; description: string | null }> }) {
  const groups = new Map<string, typeof permissions>();
  for (const permission of permissions) {
    const group = permissionGroup(permission.key);
    groups.set(group, [...(groups.get(group) ?? []), permission]);
  }
  if (!permissions.length) return <p className="text-sm text-muted-foreground">No permissions assigned.</p>;
  return <div className="grid gap-4 md:grid-cols-2">{[...groups.entries()].map(([group, values]) => <section key={group} className="rounded-lg border p-4"><h3 className="text-sm font-semibold capitalize">{group}</h3><ul className="mt-3 space-y-2">{values.map((permission) => <li key={permission.key} className="flex gap-2 text-sm"><Check className="mt-0.5 size-4 shrink-0 text-status-success" aria-hidden="true" /><span><span className="block">{permissionLabel(permission.key)}</span><span className="font-mono text-[11px] text-muted-foreground">{permission.key}</span></span></li>)}</ul></section>)}</div>;
}
