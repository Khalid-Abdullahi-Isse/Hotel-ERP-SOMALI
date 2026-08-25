"use client";

import { Button } from "@/components/ui/button";
import { permissionGroup, permissionLabel } from "@/components/admin/admin-format";

export function PermissionSelector({ permissions, selected, onChange, disabled = false }: { permissions: Array<{ key: string; description: string | null }>; selected: string[]; onChange: (keys: string[]) => void; disabled?: boolean }) {
  const groups = new Map<string, typeof permissions>();
  for (const permission of permissions) { const group = permissionGroup(permission.key); groups.set(group, [...(groups.get(group) ?? []), permission]); }
  return <div className="grid gap-4 lg:grid-cols-2">{[...groups.entries()].map(([group, values]) => {
    const groupKeys = values.map((value) => value.key); const allSelected = groupKeys.every((key) => selected.includes(key));
    return <section key={group} className="rounded-lg border p-4"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold capitalize">{group}</h3><Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onChange(allSelected ? selected.filter((key) => !groupKeys.includes(key)) : [...new Set([...selected, ...groupKeys])])}>{allSelected ? "Clear all" : "Select all"}</Button></div><div className="mt-3 space-y-2">{values.map((permission) => <label key={permission.key} className="flex cursor-pointer gap-3 rounded-md p-2 hover:bg-muted/50"><input type="checkbox" className="mt-1 size-4" disabled={disabled} checked={selected.includes(permission.key)} onChange={(event) => onChange(event.target.checked ? [...selected, permission.key] : selected.filter((key) => key !== permission.key))} /><span><span className="block text-sm font-medium">{permissionLabel(permission.key)}</span><span className="block font-mono text-[11px] text-muted-foreground">{permission.key}</span></span></label>)}</div></section>;
  })}</div>;
}
