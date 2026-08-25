export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "U";
}

export function formatAdminDate(value: string | null, withTime = false): string {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en", withTime
    ? { dateStyle: "medium", timeStyle: "short" }
    : { dateStyle: "medium" }).format(new Date(value));
}

export function permissionGroup(key: string): string {
  return key.split(".")[0]?.replaceAll("_", " ") || "Other";
}

export function permissionLabel(key: string): string {
  const [, action = key] = key.split(".");
  return action.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}
